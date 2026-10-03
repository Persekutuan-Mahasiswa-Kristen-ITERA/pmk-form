# Matriks Otorisasi (Fase 1)

Model: **default-deny**. User terautentikasi tanpa baris `public.user_roles` =
**tidak ada akses admin**. Pengecekan dilakukan di **tiga lapis**:

1. **Data-access layer** (`lib/forms.ts`) — `requireAdmin()` di awal setiap
   fungsi admin. Ini lapisan terdalam; bahkan jika layout/middleware dilonggar,
   data tidak bisa diakses.
2. **Server action / route handler** — `requireAdmin()` sebelum eksekusi.
3. **Halaman/layout admin** — layout `(dashboard)` cek admin, render 403.

Lapisan **4 (pertahanan terakhir)** adalah RLS Supabase, yang diperketat di
migration 003. Lapisan **5** adalah service-role key yang hanya ada di server.

---

## Server Actions (`"use server"`)

| File | Fungsi | `requireAdmin()`? | Catatan |
|---|---|---|---|
| `app/actions/forms.ts` | `createFormAction` | ✅ YA | Tulis form |
| `app/actions/forms.ts` | `updateFormAction` | ✅ YA | Ubah form |
| `app/actions/deleteResponse.ts` | `deleteFormResponseAction` | ✅ YA | Hapus respons |
| `app/actions/submitResponse.ts` | `submitFormResponseAction` | ❌ TIDAK (sengaja) | **Publik**. Pengiriman form oleh responden anonim. Keamanan lewat validasi server (lihat bawah) |
| `app/actions/uploadFile.ts` | `uploadFormAttachment` | ❌ TIDAK (sengaja) | **Publik**. Upload lampiran saat isi form. Keamanan lewat validasi upload |
| `app/actions/uploadFile.ts` | `uploadFile` | ⚠️ Perlu tinjauan | Wrapper duplikat. Lihat "Temuan" di bawah |
| `app/actions/revalidate.ts` | `revalidateForm` | ❌ TIDAK | Revalidasi cache publik setelah submit. Aman: hanya cache, tidak baca data sensitif |
| `app/actions/revalidate.ts` | `revalidateFormAdminData` | ❌ TIDAK | Revalidasi cache admin. Idempoten, tidak kembalikan data |
| `app/actions/revalidate.ts` | `revalidateRecruitment` | ⚠️ Mati | Legacy route `/recruitment/[slug]` yang **tidak ada** di kode |
| `app/actions/revalidate.ts` | `revalidateAdminData` | ⚠️ Mati | Legacy route `/admin/recruitments` yang **tidak ada** di kode |

### Validasi server pada action publik (bukti "publik" ≠ "tanpa proteksi")

`submitFormResponseAction` — proteksi (urutan eksekusi):

1. **Rate limit** — 10 pengiriman/menit per IP (`rateLimit("submit:"+ip, 10, 60_000)`).
   IP dari `getClientIp()` yang memprioritaskan header yang diisi platform Vercel
   (`x-vercel-forwarded-for` → `x-real-ip`), fallback ke entri **paling kanan**
   `x-forwarded-for` (lihat `lib/rate-limit.ts`).
2. **Skema input** — `z.object({ formId: z.string().uuid(), answers: z.record(...) })`.
   `formId` **harus UUID** → tidak bisa disuntik path/SQL.
3. **Form harus ada** — fetch dari DB by id; tidak ada → tolak.
4. **Form harus terbuka** — `is_open === true` DAN `close_date > now()`.
5. **Skema dinamis dari field config** — `buildFormSchema(fields)`:
   - field wajib harus diisi,
   - tipe divalidasi (teks/angka/pilihan/file),
   - **hanya field yang dideklarasikan yang tersimpan** (key asing di-strip otomatis oleh Zod),
   - string-option dinormalisasi (uppercase/trim) — dipertahankan sesuai keputusan Fase 1.
6. **max_responses** — jumlah respons sekarang < kuota.
7. **Duplikat NIM** — cek `field_applicant_nim` per form.
8. **Insert via service role** — 4 kolom eksplisit (`form_id, answers, files, respondent_id`).
   `formId` sudah divalidasi UUID di langkah 2, jadi tidak ada suntikan ke insert.

`uploadFormAttachment` — proteksi:

1. **formId harus cocok `UUID_RE`** (sebelum dipakai di path storage) → anti path injection.
2. **MIME type di-whitelist** (`ALLOWED_FILE_TYPES`).
3. **Ekstensi nama file di-whitelist** (`ALLOWED_EXTENSIONS`) — defense-in-depth, karena MIME bisa dipalsukan client.
4. **Ukuran ≤ 10MB** (`MAX_FILE_SIZE`).
5. **Nama file disanitasi** — `file.name.replace(/[^a-zA-Z0-9.-]/g, "_")`
   (hanya alfanumerik, titik, strip; spasi/`../`/unicode di-replace `_`).
6. **Respondent key disanitasi** — `.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)`,
   default `"anonymous"` jika kosong. Mencegah segment path injection.
7. **`upsert: false`** — tidak bisa menimpa file existing.

### Upload — bukti per-klaim (a)–(d)

**(a) Nama file di-sanitize** — `app/actions/uploadFile.ts`:
```ts
const safeRespondentKey = String(respondentKey)
  .replace(/[^a-zA-Z0-9_-]/g, "_")
  .slice(0, 80) || "anonymous";
const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
const objectPath = `${formId}/${safeRespondentKey}/${Date.now()}-${safeFileName}`;
```
`formId` juga sudah lolos `UUID_RE` (bukan input bebas) jadi path hanya bisa
`<uuid>/<sanitized>/<ts>-<sanitized>`. Tidak ada `../` yang lolos.

**(b) MIME + ukuran divalidasi di server action** (bukan hanya di client):
```ts
if (!ALLOWED_FILE_TYPES.has(file.type)) { throw ... }   // MIME whitelist
const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
if (!ALLOWED_EXTENSIONS.has(extension)) { throw ... }     // ekstensi whitelist
if (file.size > MAX_FILE_SIZE) { throw ... }              // 10 MB
```
Semua cek di atas ada di dalam `"use server"` — client tidak bisa melewati
validasi ini karena bukan kode browser.

**(c) Migration 005 mengatur limit di level bucket** (pertahanan kedua di
infrastruktur Storage, di luar aplikasi):
```sql
update storage.buckets set
  file_size_limit    = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', ...]
where id = 'form-attachments';
```
Jadi meski anon key bocor atau seseorang mem-bypass server action dan upload
langsung ke Storage API, server Storage tetap menolak file > 10MB atau MIME
yang tidak di-whitelist.

**(d) SISA RISIKO yang masih ada (perlu disadari)**:

- **Storage INSERT anon masih terbuka.** RLS bucket `form-attachments` masih
  mengizinkan `anon` INSERT (diperlukan agar upload dari form publik bekerja).
  Artinya siapa pun dengan `anon_key` (ada di bundle browser, memang publik)
  bisa upload langsung ke bucket tanpa lewat server action kita.
  **Konsekuensi**: penyerang bisa mengisi bucket dengan file (maks 10MB,
  MIME whitelist saja) → **pemakaian kuota Storage / abuse biaya**.
  **Yang sudah membatasi**: migration 005 (ukuran + MIME), bucket tidak mengizinkan
  overwrite file orang lain (RLS INSERT tanpa policy update untuk anon).
- **Tidak ada rate limit khusus upload.** `uploadFormAttachment` tidak memanggil
  `rateLimit()` (hanya submit action yang kena). Spam upload hanya dibatasi oleh
  10MB/MIME + kuota Vercel function. → **mitigasi: tambahkan rate limit upload
  di Fase 2**, atau pindahkan upload ke masuk ke `submitFormResponseAction`.
- **MIME bisa dipalsukan** (`file.type` dibaca dari header Content-Type client).
  Karena itu ada cek ekstensi terpisah, tapi dua-duanya bisa dikocoki bersamaan
  (mis. `evil.pdf` berisi script). **Bucket hanya cek MIME + extension, bukan
  isi file**. Risiko: file `.pdf` berisi HTML/JS bisa di-upload lalu dibuka
  langsung di domain Storage → **stored XSS jika origin bucket sama dengan
  aplikasi**. Mitigasi yang disarankan: Supabase bucket mengirim `Content-Type`
  sesuai upload (bukan `text/html`) + `Content-Disposition: attachment`, jadi
  browser tidak menjalankannya; **verifikasi header response bucket** di Fase 2.
- **Nama file sangat panjang** tidak dibatasi eksplisit (hanya `safeFileName`
  tanpa `.slice()`). Path maks Supabase 1024 char; praktis tidak bisa diabuse,
  tapi bisa ditambah `slice(0, 200)` di Fase 2.

---

## Route Handlers (`route.ts`)

| File | Method | `requireAdmin()`? | Proteksi lain | Catatan |
|---|---|---|---|---|
| `app/api/cek-hasil/route.ts` | `POST` | ❌ TIDAK (sengaja) | **Rate limit** (15/menit/IP), baca via **service role** | Publik: cek hasil seleksi per NIM+email. Tidak ada `any` (sudah dityped) |

---

## Halaman Admin & Proteksi

| Halaman | Proteksi | Catatan |
|---|---|---|
| `app/admin/login/page.tsx` | ❌ publik | Halaman login |
| `app/admin/(dashboard)/layout.tsx` | ✅ `getAdminUser()` → 403 jika bukan admin | **Pintu gerbang** semua halaman di bawah |
| `app/admin/(dashboard)/dashboard/page.tsx` | ✅ layout + RLS | |
| `app/admin/(dashboard)/forms/page.tsx` | ✅ layout + `getAllForms` (requireAdmin) + `countFormResponses` (requireAdmin) + `countActiveForms` (requireAdmin) | |
| `app/admin/(dashboard)/forms/new/page.tsx` | ✅ layout + `createFormAction` (requireAdmin) | |
| `app/admin/(dashboard)/forms/[id]/page.tsx` | ✅ layout + `getFormById` (requireAdmin) | |
| `app/admin/(dashboard)/forms/[id]/responses/page.tsx` | ✅ layout + `getFormById` + `getAllFormResponses` (requireAdmin) | |

---

## Fungsi Data-Access `lib/forms.ts`

| Fungsi | `requireAdmin()`? | Dipakai oleh |
|---|---|---|
| `getOpenForms` | ❌ publik | Landing page `/` |
| `getFormBySlug` | ❌ publik | Halaman form `/form/[slug]` |
| `getFormById` | ✅ YA | `forms/[id]`, `forms/[id]/responses` |
| `getAllForms` | ✅ YA | `forms/page` |
| `countActiveForms` | ✅ YA | `forms/page` |
| `createForm` | ✅ YA | `createFormAction` |
| `updateForm` | ✅ YA | `updateFormAction` |
| `toggleFormOpen` | ✅ YA | (belum dipakai UI — tombol toggle di Fase 2) |
| `deleteForm` | ✅ YA | (belum dipakai UI) |
| `submitFormResponse` | ❌ publik | (digantikan oleh action; dipertahankan untuk kompat) |
| `getFormResponses` | ✅ YA | (belum dipakai — responses page pakai `getAllFormResponses`) |
| `getAllFormResponses` | ✅ YA | `forms/[id]/responses` |
| `countFormResponses` | ✅ YA | `forms/page` |
| `checkDuplicateResponse` | ❌ publik | `submitFormResponseAction` (via service client) |
| `deleteFormResponse` | ✅ YA | `deleteFormResponseAction` |
| `getCurrentUserRole` | ❌ publik | Helper identitas |
| `getCurrentUserPermissions` | ❌ publik | Helper identitas (default-deny) |
| `getAllUserRoles` | ❓ belum | Manajemen role — **Fase 4** (harus super_admin) |
| `upsertUserRole` | ❓ belum | Manajemen role — **Fase 4** (harus super_admin) |
| `removeUserRole` | ❓ belum | Manajemen role — **Fase 4** (harus super_admin) |

### Bukti: `requireAdmin()` hanya di 11 fungsi admin

Dicek dengan parse per-fungsi atas `lib/forms.ts` (bukan grep global):

```text
fungsi                       requireAdmin?    baris
----------------------------------------------------------
getOpenForms                 tidak (publik)   L18
getFormBySlug                tidak (publik)   L33
getFormById                  YA (admin)       L49
getAllForms                  YA (admin)       L66
countActiveForms             YA (admin)       L94
createForm                   YA (admin)       L107
updateForm                   YA (admin)       L123
toggleFormOpen               YA (admin)       L141
deleteForm                   YA (admin)       L156
submitFormResponse           tidak (publik)   L168
getFormResponses             YA (admin)       L188
getAllFormResponses          YA (admin)       L211
countFormResponses           YA (admin)       L227
checkDuplicateResponse       tidak (publik)   L247
deleteFormResponse           YA (admin)       L265
getCurrentUserRole           tidak (publik)   L280
getCurrentUserPermissions    tidak (publik)   L308
getAllUserRoles              tidak (publik)   L336
upsertUserRole               tidak (publik)   L348
removeUserRole               tidak (publik)   L362

=> fungsi dengan requireAdmin(): 11
=> fungsi TANPA requireAdmin()  : 9
CEK KERAS: fungsi publik yang seharusnya bebas tapi terkunci -> TIDAK ADA ✓
```

**6 fungsi publik** (`getOpenForms`, `getFormBySlug`, `submitFormResponse`,
`checkDuplicateResponse`, `getCurrentUserRole`, `getCurrentUserPermissions`)
**tidak** terkunci — diperlukan agar landing page, halaman form publik, dan
alur submit anonim tetap berfungsi. `checkDuplicateResponse` memang bebas
`requireAdmin()` tetapi hanya dipanggil dari `submitFormResponseAction` yang
sudah dibatasi rate limit dan memvalidasi `formId` UUID + NIM.

---

## RLS Supabase (setelah migration 003 + 007 dijalankan)

| Tabel | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `forms` | publik (`is_open=true`) + admin (`is_open=true OR is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) |
| `form_responses` | admin (`is_admin()`) | **tidak ada policy** (hanya service role) | — | admin (`is_admin()`) |
| `selection_results` | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) |
| `submissions` (legacy) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) |
| `recruitments` (legacy) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) |
| `user_roles` | admin (`is_admin()`) + user baca baris sendiri | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) |
| storage `form-attachments` | publik (baca URL) | anon+auth (upload, whitelist extension) | admin (`is_admin()`) | admin (`is_admin()`) |

**Catatan penting tentang `selection_results`**: `/api/cek-hasil` memakai
**service role** (bypass RLS), jadi fitur cek hasil publik **tetap berfungsi**
setelah RLS diperketat.

**Catatan tentang `forms` SELECT admin**: policy lama `using (true)` diganti
menjadi `using (is_open = true or public.is_admin())`. Dampak: saat form
**tertutup**, user biasa/anon yang membuka `/form/[slug]` tidak lagi
menerima data form (`getFormBySlug` kembali null → halaman menampilkan
"form tidak ditemukan"). Ini peningkatan keamanan: struktur form tertutup
tidak lagi bocor ke publik. Landing page `/` tidak terpengaruh karena
`getOpenForms` sudah memfilter `is_open=true`.

**Catatan tentang `form_responses` INSERT**: setelah 003, tidak ada policy
INSERT sama sekali → client browser biasa tidak bisa insert. Submit publik
hanya via server action (service role). Ini menggantikan migration 004 yang
digabung ke 003.

**Catatan tentang `user_roles` (migration 007)**: policy lama "Super admin can
manage all roles" memakai subquery ke `user_roles` SENDIRI → **infinite
recursion** (error PostgreSQL "infinite recursion detected in policy") →
semua operasi tulis super_admin gagal. Diganti dengan policy yang memakai
`public.is_admin()` (SECURITY DEFINER → dieksekusi sebagai owner, **mem-bypass
RLS**, tidak rekursif). Policy "User can view own role" tetap (tidak rekursif: hanya
membandingkan `user_id = auth.uid()`).

**Catatan tentang `submissions` / `recruitments` (migration 007)**: tabel
legacy yang sudah dimigrasi penuh ke `forms`/`form_responses`. Tidak ada
kode aplikasi yang membacanya lagi. Policy lamanya tidak terdokumentasi
(dibuat di schema pra-001), jadi 007 memakai **drop dinamis dari
`pg_policies`** (bukan nama tebakan) agar tidak ada policy permisif yang
lolos.

---

## Temuan untuk Fase 2 (bukan scope Fase 1)

1. **`uploadFile` di `app/actions/uploadFile.ts`** — wrapper duplikat `uploadFormAttachment`.
   Perlu konfirmasi 0 pemanggil sebelum hapus.
2. **`revalidateRecruitment` / `revalidateAdminData`** — legacy route yang tidak ada
   (`/recruitment/[slug]`, `/admin/recruitments`). Perlu grep pemanggil sebelum hapus.
3. **`submitFormResponse` di lib/forms.ts** — sudah digantikan server action; cek pemangkir.
4. **`getFormResponses`** — kembaran `getAllFormResponses`; responses page hanya pakai satu.
5. **Fungsi manajemen role** (`getAllUserRoles`, `upsertUserRole`, `removeUserRole`) —
   belum dipakai UI; akan dipakai Fase 4 dengan proteksi super_admin.
