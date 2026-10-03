# PROGRESS — PMK Form Platform

Sumber kebenaran untuk status pekerjaan. Baca file ini, `docs/AUTHORIZATION_MATRIX.md`,
dan `git log` terlebih dulu saat melanjutkan sesi.

**Branch saat ini:** `chore/cleanup-and-hardening` — ✅ **DI-MERGE KE MAIN** (PR #3, 2026-10-03)
**Status:** GATE 0 SELESAI. Fase 1 + 1.5 sudah live di produksi.
**Diperbarui:** setelah GATE 0 lengkap — semua verifikasi lulus

---

## STATUS FASE

| Fase | Status | Keterangan |
|---|---|---|
| Fase 0 — verifikasi & baseline | ✅ SELESAI | tsc/eslint/build, audit RLS, snapshot data produksi |
| Fase 1 — keamanan (otorisasi) | ✅ SELESAI & LIVE | migration 002/002b/003/007 dijalankan; PR #3 di-merge; produksi redeploy |
| Fase 1.5 — hardening | ✅ SELESAI & LIVE | rate limit, upload hardening, matriks otorisasi |
| GATE 0 | ✅ **SELESAI** | semua 7 item verifikasi lulus |
| Fase 2 — pembersihan redundansi | 🔄 DALAM PROSES | branch `chore/cleanup-redundancy`; 8 poin selesai, menunggu checkpoint |
| Fase 3 — enforce form config | ⬜ BELUM MULAI | |
| Fase 4 — keputusan strategis | ⬜ BELUM MULAI | |
| Fase 5 — OAuth Google + admin | ⬜ BELUM MULAI | |
| Fase 6 — Google Sheets | ⬜ BELUM MULAI | |
| Fase 7 — opsional | ⬜ BELUM MULAI | |

---

## KEPUTUSAN YANG SUDAH DISETUJUI

1. **Admin default-deny via `user_roles`**: user terautentikasi tanpa baris `user_roles` = tidak ada akses
   admin. Opsi 1 (`user_roles` + `requireAdmin()`) dipilih. Enforcement per-divisi ditunda ke Fase 4.
2. **`is_admin()` SECURITY DEFINER** dengan `SET search_path = public`; REVOKE dari `public`/`anon`,
   GRANT hanya ke `authenticated`. Catatan teknis: fungsi ini **mem-bypass RLS** karena dieksekusi
   sebagai owner — bukan "dievaluasi lewat RLS".
3. **Submit via server action + service role**: `submitFormResponseAction` memvalidasi
   (form terbuka/close_date/max_responses/duplikat NIM/skema Zod) lalu insert via service role.
4. **Viewer toleran key**: `resolveAnswer()` membaca `answers[field.id] ?? answers[field.label]`
   supaya data lama (key=label) & baru (key=id) tampil tanpa remap data produksi.
5. **Normalisasi string-option DIPERTAHANKAN**: data produksi memakai `string[]` untuk opsi;
   jangan hapus pemetaan itu di `toRendererConfig()`.
6. **Renderer baca `helpText ?? helperText`** (11 helper text produksi memakai `helperText`).
7. **Migration 006 hanya usulan** untuk Fase 2/3 (kolom `nim_normalized` + unique PARTIAL index).
   **Data lama TIDAK disentuh** (5 pasang duplikat NIM dibiarkan).
8. **Migration 004 digabung ke 003** (bagian 2b); file 004 menjadi penanda.
9. **`getClientIp()` env-aware**: `TRUSTED_PROXY=vercel|cloudflare|nginx|none`, default `vercel`,
   fail-safe ke `vercel` bila nilai tak dikenal. Fallback selalu elemen **terakhir** `x-forwarded-for`
   (anti spoofing).
10. **Platform deployment: Vercel.**
11. **Tes 403 untuk user biasa di-skip (Opsi B)** saat GATE 0: signup publik sudah
    dimatikan + tidak ada halaman signup → hanya 1 user (admin). Validasi 403
    akan dilakukan ulang setelah **OAuth Google** (Fase 5) diaktifkan, saat sudah
    ada user non-admin sungguhan. Login admin terverifikasi = bukti 002b bekerja.

---

## MIGRATION STATUS (semua dijalankan kecuali 006 yang masih usulan)

| File | Status | Kapan dijalankan (rencana) |
|---|---|---|
| `002` `is_admin()` + seed | ✅ **SUDAH DIJALANKAN & TERVERIFIKASI** | Selesai GATE 0: seed super_admin `biroitpmkitera@gmail.com` |
| `002b` perbaiki recursion policy `user_roles` | ✅ **SUDAH DIJALANKAN** | Selesai GATE 0 (bersama 002) |
| `003` perketat RLS + tutup anon INSERT | ✅ **SUDAH DIJALANKAN & TERVERIFIKASI** | Selesai GATE 0 (bersama 007) |
| `004` (penanda; isinya di 003 bagian 2b) | — | Jangan dijalankan sendiri |
| `005` limit bucket storage | ✅ **SUDAH DIJALANKAN** | Selesai GATE 0 (verifikasi via SQL Editor, lihat di bawah) |
| `006` USULAN `nim_normalized` | ⬜ usulan Fase 2/3 | Jangan dijalankan sekarang |
| `007` tabel legacy → admin only | ✅ **SUDAH DIJALANKAN & TERVERIFIKASI** | Selesai GATE 0 (bersama 003) |

**Catatan kritis 002b**: policy lama `"Super admin can manage all roles"` (FOR ALL, subquery ke
`user_roles` sendiri) menyebabkan error `42P17` pada SELECT juga → `getAdminUser()` fail-closed
untuk **semua** user → login admin mendapat 403 setelah deploy. Karena itu 002b **harus** dijalankan
bersama 002, sebelum deploy. Masalah ini lolos di Fase 0 karena `user_roles` masih kosong.

**Status 002b setelah dijalankan**: `is_admin()` sudah ada di DB, seed admin sudah ada.

---

## ROLLOUT FASE 1 (11 langkah — urutan WAJIB)

1. Backup DB (WAJIB — 007 tidak bisa rollback tanpa backup)
2. Matikan signup publik (Supabase Dashboard → Authentication)
3. Jalankan **migration 002 + 002b** bersamaan → cek `RAISE NOTICE "SEED ADMIN OK"`; berhenti jika gagal
4. Deploy kode Fase 1
5. Verifikasi: admin masuk `/admin/dashboard`; user biasa → 403 (bukti 002b bekerja, no `42P17`)
6. **Buat form tes sementara** (`is_open=true`, close +1 jam) — semua form produksi tertutup
7. Jalankan **migration 003 + 007** satu sesi; uji submit form tes (wajib sukses sebelum lanjut)
8. Verifikasi V1–V4 (lihat file 003)
9. Tutup/hapus form tes
10. Jalankan **migration 005**
11. Signup publik: hidupkan hanya jika perlu

---

## LANGKAH MANUAL YANG MENUNGGU

- [x] Backup database produksi → SKIP (ganti snapshot policy; data 100% utuh)
- [x] Matikan signup publik → sudah aktif (disable_signup=true, verifikasi API)
- [x] Migration 002 + 002b → ✅ terverifikasi (seed super_admin)
- [x] Push branch & PR #3 → ✅ MERGED 2026-10-03
- [x] Env Vercel `SUPABASE_SERVICE_ROLE_KEY` → ✅ ada (submit E2E berhasil)
- [x] Deploy + verifikasi admin login → ✅
- [x] Migration 003 + 007; V1–V3 → ✅ terverifikasi via API
- [x] Submit E2E (V4) di preview → ✅ berhasil (respons masuk)
- [x] Hapus form tes → ✅ `delete from forms where title='FORM UJI E2E'`
      (cascade otomatis hapus 3 respons tes; data kembali: 7 forms /
      240 form_responses / 54 selection_results / 239 submissions)
- [x] Migration 005 → ✅ dijalankan (verifikasi via SQL Editor)
- [x] Merge PR #3 ke main → ✅ produksi redeploy `deb6ef97`

## VERIFIKASI POST-GATE-0 (semua lulus)

- form_responses: 240 (service) vs 0 (anon) — data aman, anon diblokir
- forms: 7 vs 0 | selection_results: 54 vs 0 | submissions: 239 vs 0
- recruitments: 7 vs 0 (policy 'Public can view open recruitments' hilang)
- user_roles: 1 vs 0
- anon INSERT form_responses → HTTP 401 `42501` (V3)
- submit E2E di preview PR #3 → redirect `/success`, respons tersimpan (V4)
- login admin `biroitpmkitera@gmail.com` → masuk dashboard (002b bekerja,
  TIDAK ada error 42P17)
- migration 005: cek via SQL Editor —
  `select id, file_size_limit, allowed_mime_types from storage.buckets
  where id='form-attachments';` (REST tidak bisa: schema `storage` tidak
  ter-ekspos, hanya `public` + `graphql_public`)

---

## ISU TERBUKA

1. **Tidak ada form `is_open` di produksi** (snapshot Fase 0) → sudah teratasi: form tes sementara dibuat untuk V4, lalu dihapus setelah submit E2E lulus.
2. **7 error lint** pre-existing (`no-explicit-any` ×3, React Compiler `Date.now()` ×3, +1) — ditunda ke Fase 2.
3. **Storage INSERT anon masih terbuka** di bucket `form-attachments` (diperlukan upload publik).
   Mitigasi: migration 005 (limit ukuran + MIME). Sisa risiko: kuota abuse, belum ada rate limit upload,
   MIME palsu (stored-XSS via bucket) — rincian di `docs/AUTHORIZATION_MATRIX.md` bagian "SISA RISIKO upload".
4. **Nama policy lama `selection_results`/`submissions`/`recruitments` tidak terdokumentasi** (schema pra-001).
   Migration 007 memakai drop dinamis dari `pg_policies` + `RAISE NOTICE` agar nama tercatat.
   **SELESAI**: snapshot lengkap sudah diambil ke `docs/LEGACY_POLICY_SNAPSHOT.md`,
   sehingga rollback 007 kini LENGKAP memulihkan policy asli — tidak butuh backup DB.
5. **`getAdminUser()`/`requireAdmin()` belum dibungkus React `cache()`** — dijadwalkan Fase 2 langkah 7.
6. **Email admin seed**: `biroitpmkitera@gmail.com` (migration 002, RAISE EXCEPTION jika tak ditemukan).
7. **Fitur hapus form belum terwiring**: `deleteForm()` ada di `lib/forms.ts` baris 156 tapi **0 pemanggil** (tidak ada UI/server action). Form hanya bisa dihapus via SQL/Dashboard. Pertimbangkan di Fase 4: apakah perlu UI hapus form atau cukup `toggleFormOpen` (nonaktifkan).

---

## FASE 2 — pembersihan redundansi (branch `chore/cleanup-redundancy`)

Semua 8 poin dari `docs/prompts/MASTER.md` dikerjakan. Verifikasi: tsc 0 error,
eslint **0 error / 0 warning** (dari 7 error / 14 warning), `next build` OK.

1. **Data-access layer tunggal** — query inline diganti pemanggilan `lib/forms`:
   - `app/page.tsx` → `getOpenForms()` + `countOpenForms()`
   - `app/admin/(dashboard)/dashboard/page.tsx` → `getAllForms()`
   - `app/actions/forms.ts` → `createForm()` / `updateForm()`
   - `app/actions/deleteResponse.ts` → `deleteFormResponse()`
   - `app/form/[slug]/success/page.tsx` & `formOptions.ts` tetap inline karena
     butuh service role (submit anon / fetch opsi) — disengaja.
   - Fungsi role/permission **TIDAK dihapus** (menunggu Fase 4A/5).
2. **Orphan dihapus** (semua 0 pemanggil, diverifikasi grep):
   - `uploadFile()` (bucket `recruitment-files`) di `app/actions/uploadFile.ts`
   - `revalidateRecruitment()` + `revalidateAdminData()` di `app/actions/revalidate.ts`
   - `components/QRCodeCard.tsx` (success page pakai `react-qr-code` langsung)
   - dead branch `href = isRecruitment ? ... : ...` di `FormCard.tsx` (kedua
     cabang identik → `const href = /form/${slug}`)
3. **`toRendererConfig()`** — pemetaan tipe field dihapus sehingga email/tel/
   url/number kembali memakai `<input type>` yang benar. **Normalisasi
   string-option DIPERTAHANKAN** (data produksi: 12 field options `string[]`).
   Renderer baca `helpText ?? helperText` (11 helper text produksi `helperText`).
4. **Definisi tunggal "form aktif"** → `isFormActive()` di `lib/forms.ts`:
   `is_open=true AND open_date<=now AND close_date>now`. Dipakai landing,
   dashboard, `countOpenForms()`, `countActiveForms()`, `computeFormStats()`.
5. **UI duplikat diekstrak**: `components/PMKLogo.tsx` (konstanta `PMK_LOGO_URL`,
   dipakai 6 tempat), `components/landing.tsx` (`StatCard`, `FilterChip`,
   `FORM_CATEGORIES`, `computeFormStats`). `next.config` remotePatterns tetap.
6. **Lint bersih**: 3× `no-explicit-any` (hasil page: tipe `HasilResponse` +
   `catch (err: unknown)`), 2× React purity (lazy `useState` + `crypto.randomUUID()`),
   10 unused imports, `actionTypes` objek→union.
7. **`getAdminUser()` dibungkus `cache()`** — request-scoped, default-deny tak
   berubah; satu round-trip per request.
8. **Upload hardening**: rate limit 5/menit/IP, nama file dibatasi 200 char.
   Sisa risiko (MIME palsu, storage INSERT anon) butuh konfigurasi bucket,
   ditunda ke Fase 7.

## SARAN (catatan, jangan dikerjakan sebelum disetujui)

- Rate limit upload action (`uploadFormAttachment`) — lihat Fase 2 langkah 8.
- Cek header response bucket (`Content-Type`/`Content-Disposition`) untuk mitigasi stored-XSS — Fase 7.
- `nim_normalized` + unique index — Fase 3 (dari usulan migration 006).
- Manajemen admin via allowlist `admin_members` — Fase 5.

---

## FASE 3 — Enforce Form Config (branch `feat/enforce-form-config`, belum merge)

Status: SELESAI PENUH 2026-10-03. PR #5 MERGED (`97307f3`), migration 008
TERVERIFIKASI live: kolom `nim_normalized` ada (REST OK, baris lama NULL tak
tersentuh), index `idx_form_responses_nim_normalized` ada (1 baris pg_indexes).
tsc 0, eslint 0, build OK, 8 tes unit lolos.

1. **Matriks fitur** (`docs/FORM_CONFIG_MATRIX.md`): 14 setting + 7 tipe field
   diaudit (grep builder/renderer/server). Temuan kunci: `collect_identity`
   tidak diimplementasikan di mana pun (7/8 form produksi aktif), `validation`
   tidak dibaca schema, `open_date` hanya di landing, `redirect_url`/
   `show_progress`/`require_login` 0 referensi.
2. **`collect_identity` diimplementasikan** (`resolveFormFields` di lib/forms.ts
   — satu sumber kebenaran renderer + server). Suntik Nama/NIM/Email/Angkatan
   dengan id stabil `field_applicant_*` (kompatibel data lama + cek-hasil).
3. **Cek-hasil → `form_responses`**: `/api/cek-hasil` fallback ke query
   `form_responses` (contains answers NIM+email) bila `submissions` kosong.
4. **Server enforce**: submit pakai `isFormActive` (open_date kini dihormati),
   schema terapkan `validation` (min/maxLength, pattern, customMessage),
   `email`/`url`/`number` punya validasi format dengan pembeda required/optional.
5. **FieldType disatukan**: builder `text`→`short_text` (konsisten data produksi);
   tambah `email`/`phone`/`url`/`number`; renderer tangani `short_text` eksplisit;
   `datetime`/`address` tetap tidak ditawarkan (renderer belum dukung).
6. **Duplikat NIM**: `normalizeNim` tunggal (trim+upper+bersihkan) dipakai cek
   aplikasi + kolom `nim_normalized`; migration 008 (unique PARTIAL index);
   23505→pesan "sudah mengirim"; 42703→fallback graceful pra-migration.
7. **Tes unit** (`npm run test:unit`, Node bawaan, tanpa dep baru): 8 tes —
   `isFormActive`, `resolveFormFields` (4), `normalizeNim`, `buildFormSchema` (3).

---

## PRODUKSI (snapshot Fase 0, untuk konteks)

- 7 forms (semua `form_type=recruitment`, `is_open=false`)
- 240 `form_responses` (239 migrasi + 1 baru), 239 punya key `field_applicant_nim`
- `user_roles` = 0 baris; `selection_results` = 54 baris
- Signup publik aktif (`disable_signup: false`) — **harus dimatikan saat rollout**
- Tidak ada route `/recruitment/[slug]` atau `/admin/recruitments` (klaim dokumen lama salah)
