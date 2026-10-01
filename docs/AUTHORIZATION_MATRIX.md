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
   IP dari first-hop header (`x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for`).
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
5. **Nama file disanitasi** (`safeFileName`), respondent key disanitasi (`safeRespondentKey`).

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

---

## RLS Supabase (setelah migration 003 dijalankan)

| Tabel | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `forms` | publik (hanya `is_open=true`) + admin (semua) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) |
| `form_responses` | admin (`is_admin()`) | anon+auth (sampai mig 004) → admin (mig 004) | — | admin (`is_admin()`) |
| `selection_results` | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) | admin (`is_admin()`) |
| `user_roles` | (policy existing) | (policy existing) | (policy existing) | (policy existing) |
| storage `form-attachments` | publik (baca URL) | anon+auth (upload, whitelist extension) | admin (`is_admin()`) | admin (`is_admin()`) |

**Catatan penting tentang `selection_results`**: `/api/cek-hasil` memakai
**service role** (bypass RLS), jadi fitur cek hasil publik **tetap berfungsi**
setelah RLS diperketat.

**Catatan tentang `forms` SELECT admin**: policy `using (true)` untuk
`authenticated` dipertahankan supaya admin bisa lihat form tertutup di dashboard.
Pintu gerbang tulis (insert/update/delete) sudah pakai `is_admin()`.

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
