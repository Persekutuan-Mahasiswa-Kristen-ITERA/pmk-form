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

## FASE 4 — Keputusan Strategis (branch `chore/strategic-cleanup`, belum merge)

Status: KODE + DOKS SELESAI & terverifikasi (tsc 0, eslint 0, build OK,
8 tes unit lolos). Default MASTER diikuti semua (4A–4D).

1. **4A Role**: klaim berjenjang diluruskan di README + DOKUMENTASI_PROYEK
   (kode hanya cek keberadaan baris `user_roles`; `divisi_admin` tidak
   dienforce; enforce berjenjang dijadwalkan Fase 5 allowlist). Fungsi role
   tetap ada (dihapus setelah Fase 5 stabil, sesuai MASTER).
2. **4B Cek-hasil**: dropdown `/hasil` dilabeli "(Arsip)" + komentar kode
   menjelaskan arsip vs form baru. Logika tak diubah (Fase 3 sudah hubungkan
   endpoint ke `form_responses`). Opsi (1) dijadwalkan Fase 7.
3. **4C Hapus/toggle**: `deleteForm` (lib) kini MENOLAK form berisi respons
   (hitung head-count dulu). Baru: `toggleFormOpenAction` +
   `deleteFormAction` (server, requireAdmin, revalidate) dan komponen
   `FormQuickActions` di kartu admin — toggle 1-klik + hapus kunci-ganda yang
   terkunci (ikon gembok) bila ada respons.
4. **4D Dokumentasi**: klaim route mati `/recruitment/[slug]` +
   `/admin/recruitments` dihapus dari README + DOKUMENTASI_PROYEK;
   `DEPLOYMENT.md` ditulis ulang (repo benar, 4 env wajib, urutan rollout,
   verifikasi pasca-deploy, rollback kode + migration).

---

## FASE 5 — OAuth Google + Manajemen Admin (branch `feat/admin-oauth`, BELUM merge)

Status: KODE SELESAI & terverifikasi (tsc 0, eslint 0, build OK, 14 tes unit
lolos, migration 009 lolos validasi Postgres 17 container). Migration 009
BELUM dijalankan di produksi.

### CHECKPOINT 5.0 — Keputusan (sudah dijawab user)
- #5: **Google saja**; email/password dipertahankan SELAMA TRANSISI, dihapus
  setelah terverifikasi. User akan membuat akun Google per departemen.
- #6: **bebas**, tanpa batasan domain, kontrol via allowlist default-deny.
- #7: **satu level admin** (Fase 4A); semua admin = super_admin.
- #8: **Vercel**.

### Audit policy permisif (Tambahan #1, sebelum signup dinyalakan)
- grep `using (true)`/`with check (true)` di semua migration: hanya ada di
  migration 001 (sudah diganti 003) dan blok ROLLBACK 007 (komentar, tidak
  dijalankan). TIDAK ada policy permisif live untuk `authenticated`.
- Verifikasi live via API: anon SELECT forms=1 (form aktif `asdc`, expected),
  form_responses/user_roles/submissions/selection_results/recruitments = 0.
- Storage `form-attachments`: SELECT anon dibuka sengaja (lampiran publik);
  DELETE/UPDATE hanya `is_admin()`.
- TEMUAN BARU: ada form ke-8 `asdc` (is_open=true, 1 field Email, 1 respons)
  di produksi — form uji yang terlupa ditutup. Dilaporkan, TIDAK dihapus.

### Migration 009 (`migrations/009_admin_members_allowlist.sql`)
- Tabel `admin_members` (email lowercase unique, role, status
  invited|active|disabled, user_id nullable, invited_by, timestamps) +
  `admin_audit_log` (append-only: hanya policy INSERT+SELECT, tidak ada
  UPDATE/DELETE).
- `is_admin()` membaca `admin_members` (status active); SECURITY DEFINER +
  search_path public + REVOKE public/anon + GRANT authenticated dipertahankan.
- `link_admin_user_id()`: fungsi SECURITY DEFINER TANPA PARAMETER; email dari
  `auth.users` by `auth.uid()`, wajib `email_confirmed_at NOT NULL`, hanya
  user_id NULL atau pemilik baris, disabled tidak bisa reaktivasi.
- Seed otomatis dari `user_roles` join `auth.users` (tidak perlu input manual);
  RAISE EXCEPTION bila 0 admin aktif (anti-lockout). Satu transaksi.
- `user_roles` TIDAK di-drop.
- VALIDASI (Postgres 17 container isolated): happy path `SEED ADMIN OK: 1
  admin aktif` + COMMIT; guard menolak saat 0 admin; link skenario A-E lolos
  (invited->active, anti-rebut, constraint lowercase, disabled tetap).

### Kode
- `lib/auth.ts`: `getAdminUser` baca `admin_members` (status active double-
  check); baru `requireSuperAdmin()`. Dihapus: 5 fungsi legacy `user_roles`
  (getCurrentUserRole, getCurrentUserPermissions, getAllUserRoles,
  upsertUserRole, removeUserRole) — semua 0 pemanggil.
- `app/auth/callback/route.ts`: exchangeCodeForSession + RPC
  `link_admin_user_id` + `sanitizeNextPath` (anti open redirect).
- `app/actions/adminMembers.ts`: listAdminMembers, inviteAdminAction,
  updateAdminRoleAction, setAdminStatusAction, deleteAdminAction. Semua
  `requireSuperAdmin()`; guard self-delete, self-disable, last-super_admin;
  audit log di setiap aksi.
- `app/admin/(dashboard)/users/page.tsx` + `components/AdminUsersClient.tsx`:
  halaman manajemen admin (invite, aktifkan/nonaktifkan, hapus, konfirmasi).
- `components/GoogleLoginButton.tsx`: OAuth PKCE -> /auth/callback.
- `app/admin/login/page.tsx`: tombol Google + email/password (transisi),
  pesan error aman (tidak bocor apakah email terdaftar).
- Layout admin: nav "Admin" hanya untuk super_admin.
- Tes: 14 total (6 baru: sanitizeNextPath 5 skenario + normalisasi email).

### Rollout (URUTAN WAJIB, lihat CHECKPOINT 5.6)
1. Backup DB.
2. Migration 009 DULU, baru deploy kode (Tambahan #3).
3. Nyalakan signup + matikan email provider (Tambahan #1) + setup Google OAuth
   di Supabase (panduan lengkap di checkpoint 5.6).
4. Verifikasi, lalu hapus email/password.

---

## FASE 6 — Integrasi Google Sheets (branch `feat/sheets-sync`, BELUM merge)

Keputusan CHECKPOINT 6.2 (disetujui user via `lanjut`): (a) `google-auth-library`
+ fetch REST ringan (bukan `googleapis` full SDK), (b) config JSONB `sheets_config`
di `forms` mengikuti pola `settings`, (c) panduan service account ditulis.

Yang dikerjakan:
- `migrations/010_sheets_integration.sql`: kolom `forms.sheets_config` JSONB
  (NULL = tanpa integrasi) + tabel `sheets_outbox` (PK response_id, status
  pending|synced|failed, attempts, next_attempt_at, last_error sanitasi,
  synced_at) + 2 index + RLS admin-only. Tervalidasi Postgres 17 isolated:
  COMMIT, objek lengkap, idempoten 2x (0 error). Rollback aman di komentar file.
- `lib/sheets/format.ts`: fungsi murni (escape formula `=+-@`, flatten array,
  buildRow id-dulu-label-fallback, buildHeader + `__response_id`, sanitizeError
  buang JWT/potong 250, backoff 2^n maks 60, parse ID dari URL).
- `lib/sheets/client.ts` (server-only): service account + fetch REST (RAW mode,
  ensureHeader aturan tambah/hapus/rename, rowExists max 500 baris,
  appendRows batch, testConnection 404/403/judul-sheet).
- `lib/sheets/sync.ts`: syncOne + processOutboxBatch(50), gagal max 5x lalu failed.
- `submitResponse.ts`: enqueue outbox + `after()` best-effort di KEDUA jalur
  sukses (utama + fallback 008); migrasi 010 belum jalan = dilewati diam-diam.
- `app/actions/sheetsConfig.ts`: save/get/test/retry/backfill (batched 200,
  upsert ignoreDuplicates) — semua `requireAdmin()`.
- `app/api/cron/sheets-sync/route.ts`: CRON_SECRET constant-time, tanpa input.
  `vercel.json`: cron tiap 5 menit.
- `components/SheetsSettingsPanel.tsx` di halaman edit form + peringatan PII +
  email service account untuk di-share.
- `types/forms.ts`: `sheets_config?` opsional. `.env.example`: 3 env baru.
- `docs/SHEETS_SETUP.md`: panduan service account + rollout + uji E2E dummy.
- `tests/sheets.test.ts`: 12 tes baru, total 26/26 lulus.
- Verifikasi: tsc 0, eslint 0, build OK (`/api/cron/sheets-sync` terdaftar),
  secret tidak di client/bundle, pola resolveAnswer sesuai viewer.
- Rollout (user): Cloud project + service account + env → migration 010 →
  deploy → uji form tes spreadsheet tes data DUMMY → aktifkan per form → backfill.

---

## FASE 7 — Peningkatan opsional (satu per satu, branch per item)

Urutan disetujui user (balasan `lanjut`): CI → Turnstile → status respons
→ duplikasi form → audit log → soft delete/backup → sisanya kalau dibutuhkan.

### Item 1: CI GitHub Actions (branch `ci/github-actions`, **PR #13 MERGED**)

- `.github/workflows/ci.yml`: jalankan tiap PR + push ke cabang utama.
  Langkah berurutan: `npm ci` → `npx tsc --noEmit` → `npx eslint .` →
  `npm run test:unit` → `npm run build`. Gagal satu = PR merah.
- Node 24 (bukan 20): tes unit memakai file `.ts` langsung, Node 20 menolak
  ekstensi `.ts` (ERR_UNKNOWN_FILE_EXTENSION, ditemukan saat CI pertama merah).
- Env placeholder DUMMY pendek untuk build (bukan kredensial asli; runtime
  tidak diuji di CI).
- concurrency batalkan run lama, permission `contents: read`, timeout 20 mnt,
  artifact `.next` retensi 3 hari.
- Verifikasi lokal dgn placeholder yg sama: tsc 0, eslint 0, 31/31 tes, build OK.
  CI GitHub: hijau 57 dtk setelah fix Node.

### Item 2: Cloudflare Turnstile (branch `feat/turnstile`, **PR #14 MERGED 2026-10-05**)

- `lib/turnstile.ts` (server-only): `verifyTurnstileToken()` — fetch ke
  `siteverify` Cloudflare memakai SECRET KEY. Fail-open: gangguan Cloudflare
  TIDAK menggagalkan submit, tapi token kosong/invalid DITOLAK.
- `components/TurnstileWidget.tsx`: script resmi Cloudflare (render explicit)
  TANPA dependency npm baru; dedup script + cleanup widget on unmount.
- `GenericFormRenderer`: widget tampil di atas tombol submit saat
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` terisi DAN `settings.require_captcha !== false`.
- `submitResponse`: verifikasi token di server SETELAH form dimuat (per-form),
  sebelum simpan.
- `GenericFormBuilder`: switch "Verifikasi Anti-Bot" di pengaturan tambahan.
- Env baru: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (publik) + `TURNSTILE_SECRET_KEY`
  (server saja). Keduanya kosong = fitur nonaktif total.
- `docs/TURNSTILE_SETUP.md`: langkah dashboard Cloudflare + env + uji + matriks
  keamanan.
- `tests/stubs/server-only.mjs` + registrasi di loader: agar modul server-only
  bisa diuji unit (manfaat untuk item Fase 7 berikutnya).
- Verifikasi: tsc 0, eslint 0, build OK, 39/39 tes (8 baru).

### Item 3: Status respons (branch `feat/status-respons`, **PR #15 MERGED 2026-10-05**)

**Keputusan: Opsi A — pensiunkan total `/hasil` + `/api/cek-hasil`.**
Tabel `selection_results` (54 baris, departemen/divisi OPREC lama) tidak cocok
untuk form generik. Halaman cek-hasil publik akan **dibangun ulang nanti** dengan
lebih proper (baca `form_responses.status`). Penghapusan hanya di kode aplikasi —
**tabel legacy TIDAK di-drop** (data tetap utuh, no destruktif).

Yang dilakukan:

- `migrations/011_response_status.sql` (non-destruktif, teruji di Postgres 17
  isolated): kolom `form_responses.status text` (NULL = belum diproses) dengan
  CHECK constraint (`diterima` / `tidak_lolos` / `cadangan`), partial index
  `idx_form_responses_status`, dan policy RLS baru
  "Admins can update response status" (UPDATE, hanya `is_admin()`).
  Idempoten 2x; data lama tetap NULL semua.
- `types/forms.ts`: tipe `ResponseStatus` + map `RESPONSE_STATUS_LABELS`;
  `FormResponse.status?`.
- `app/actions/responseStatus.ts`: `updateResponseStatusAction` (validasi zod,
  `requireAdmin()`, deteksi 42703 = migration belum jalan) +
  `bulkUpdateStatusAction` (batch via `.in()`).
- `components/StatusCell.tsx`: dropdown status per baris (badge berwarna),
  `useTransition` supaya tidak memblokir UI.
- `components/GenericResponseTable.tsx`: kolom Status + filter dropdown +
  kolom "Status" di export CSV.
- **Dihapus (pensiun)**: `app/hasil/page.tsx`, `app/api/cek-hasil/route.ts`,
  `app/actions/formOptions.ts` (`getRecruitmentFormOptions` — hanya dipakai
  `/hasil`, 0 pemanggil lain). Tidak ada link UI ke `/hasil` sebelumnya.
- Komentar di `lib/forms.ts` & `lib/supabase/service.ts` yang merujuk
  `cek-hasil` diperbarui.
- Verifikasi: tsc 0, eslint 0, build OK (route `/hasil` & `/api/cek-hasil`
  hilang dari output build), 39/39 tes.

**Belum (dikerjakan nanti, item terpisah)**: halaman publik cek-hasil baru
yang membaca `form_responses.status` + label per form. Karena semua form
produksi sudah tutup, tidak ada urgensi.

**Rollout (WAJIB sebelum/sesudah merge)**:
1. Jalankan migration 011 ke produksi (sudah terverifikasi idempoten).
2. Merge/deploy kode.
3. Status langsung dapat dipakai di tabel respons admin. Bila migration
   belum jalan, UI menampilkan pesan jelas (bukan crash).

**Status merge**: PR #14 (Turnstile) & PR #15 (status respons) SAMA-SAMA sudah
merged ke cabang utama. Branch lokal yang sudah merged sudah dibersihkan
(sisa: `chore/cleanup-and-hardening`, belum fully merged).

### Item 4: Duplikasi form (branch `feat/duplikasi-form`)

Salin konfigurasi form (judul, deskripsi, tipe, fields, settings) ke form
baru dengan 1 tombol di kartu admin. Tujuan: membuat form baru untuk periode
baru (mis. OPREC 2026) tinggal duplikasi form lama + edit, bukan dari nol.

- `lib/forms.ts`: `duplicateForm(sourceId)` — ambil form sumber, cari slug
  unik otomatis (`slug-copy`, `slug-copy-2`, ...), insert form baru.
  **`is_open` SELALU false** di duplikat (harus dibuka manual setelah
  diperiksa). `sheets_config` sengaja **TIDAK disalin** (dua form menulis ke
  1 spreadsheet = kacau; admin atur sendiri di panel Sheets).
  `duplicateSlugCandidate()` dipisah jadi fungsi murni agar bisa dites unit.
- `app/actions/forms.ts`: `duplicateFormAction` (requireAdmin via lib,
  revalidate, kembalikan form baru).
- `components/FormQuickActions.tsx`: tombol `Copy` — setelah sukses, admin
  langsung diarahkan ke halaman edit form baru + toast peringatan "periksa
  dulu sebelum dibuka".
- **Respons TIDAK disalin** — duplikat selalu kosong (aman dihapus bila salah).
- Tidak butuh migration (hanya insert baris baru di tabel `forms`).
- Verifikasi: tsc 0, eslint 0, build OK, 41/41 tes (2 baru untuk logika slug).

### Item 5: Audit log diperluas (branch `feat/audit-log`)

Perluas `admin_audit_log` (Fase 5, hanya aksi admin-members) ke SEMUA aksi
admin penting, + halaman viewer.

- `migrations/012_expand_audit_log.sql` (non-destruktif): longgarkan CHECK
  constraint `admin_audit_log_action_check` (drop+add, data lama tetap valid)
  untuk menerima aksi baru: `form_create`, `form_update`, `form_delete`,
  `form_duplicate`, `form_toggle`, `response_delete`,
  `response_status_update`, `sheets_config_save`. Tambah index
  `idx_admin_audit_log_created_at`. **Append-only tetap** — tidak ada policy
  UPDATE/DELETE (baris tak bisa diubah/dihapus). Tervalidasi Postgres 17
  isolated: aksi invalid ditolak, data lama utuh, idempoten 2x.
- `lib/audit.ts` (server-only): `audit()` (wajib, lempar bila gagal),
  `auditBestEffort()` (menelan error untuk aksi ringan), `getAuditLog()`.
  **Actor diambil dari sesi server**, bukan payload client — admin tidak bisa
  mencatat aksi atas nama admin lain.
- `app/actions/adminMembers.ts`: fungsi audit lokal diganti dengan
  `lib/audit` terpusat (implementasi sama, duplikasi dihilangkan).
- Aksi teraudit: `forms.ts` (create/update/delete/duplicate/toggle),
  `deleteResponse.ts` (response_delete), `responseStatus.ts`
  (response_status_update, bulk catat jumlah), `sheetsConfig.ts`
  (sheets_config_save).
  - Detail minimal, tidak membocorkan jawaban responden (mis. hanya id form,
    tidak ada NIM/nama). Aksi delete memakai `audit()` (wajib); toggle &
    status respons memakai `auditBestEffort` (aksi ringan).
- `app/admin/(dashboard)/audit/page.tsx`: tabel viewer super_admin-only
  (waktu, aksi, oleh, target, detail) + nav link "Audit Log" di layout.
- Verifikasi: tsc 0, eslint 0, build OK (route `/admin/audit` muncul),
  43/43 tes (2 baru memastikan kontrak error helper audit).

### Item 6: Soft delete form + halaman sampah (branch `feat/soft-delete-form`)

Sebelumnya form berisi respons TIDAK BISA dihapus sama sekali (Fase 4C,
hard-delete ditolak). Sekarang bisa dihapus dengan aman via soft delete:

- `migrations/013_soft_delete_form.sql` (non-destruktif): kolom
  `forms.is_deleted boolean NOT NULL DEFAULT false` + `deleted_at timestamptz`.
  Data lama semua false (tidak ada yang tiba-tiba "dihapus"). 2 partial index:
  `idx_forms_active` (baris tidak dihapus) & `idx_forms_deleted` (sampah).
  Tervalidasi Postgres 17 isolated: default benar, idempoten 2x.
- `lib/forms.ts`:
  - `deleteForm()`: form **PUNYA respons** -> soft delete (is_deleted=true,
    sembunyikan, data utuh); form **KOSONG** -> hard delete (seperti Fase 4C).
    Mengembalikan `{ softDeleted }`.
  - `restoreForm()` baru: batalkan soft delete.
  - **Semua 6 query baca memfilter `is_deleted = false`**: `getOpenForms`,
    `countOpenForms`, `getFormBySlug` (public), `getFormById`, `getAllForms`,
    `countActiveForms` (admin). `getAllForms` dapat opsi `includeDeleted`
    untuk halaman sampah.
- `types/forms.ts`: `Form.is_deleted?` + `Form.deleted_at?`.
- `app/actions/forms.ts`: `deleteFormAction` (kembalikan `softDeleted`, audit
  catat soft/hard) + `restoreFormAction` baru.
- `components/FormQuickActions.tsx`: tombol hapus sekarang aktif untuk form
  berisi respons (sebelumnya dikunci). Pesan jelas bedakan soft/hard delete.
- `components/TrashFormsClient.tsx` + `app/admin/(dashboard)/forms/trash/page.tsx`:
  halaman sampah (daftar form terhapus + jumlah respons + tombol Kembalikan).
- Link "Sampah" di halaman daftar form.
- Verifikasi: tsc 0, eslint 0, build OK (route `/admin/forms/trash` muncul),
  43/43 tes.

**Rollout**: jalankan migration 013 ke produksi (default false, aman) sebelum
merge/deploy. Bila belum jalan, query baca akan error 42703 (undefined_column)
-> halaman form gagal load. Pastikan migration jalan DULU.

### Item 7: Dokumentasi backup & pemulihan (branch `docs/backup-prosedur`)

Tidak ada perubahan kode/migration — hanya dokumentasi.

- `docs/BACKUP_PROCEDURE.md` (baru): prosedur backup & pemulihan lengkap.
  Bagian utama:
  - **Kenapa backup DB penuh di-skip** (kejujuran teknis): paket Free/Pro
    Supabase; diganti dengan prinsip migration non-destruktif + snapshot
    policy + soft delete + audit append-only.
  - Yang wajib di-backup (kode+migration di git otomatis; env var di Vercel).
  - Prosedur berkala manual gratis: cek kesehatan DB bulanan (query
    read-only) + export manual 3 bulanan + **cara tes backup bisa
    dipulihkan** (restore ke docker postgres, bandingkan angka).
  - Playbook pemulihan 4 kasus: migration rusak, deploy rusak, form publik
    error mendadak, dan **data hilang total**.
  - **Matriks apa yang bisa/tidak bisa dipulihkan** — penemuan penting:
    - `form_responses` bisa direkonstruksi **sebagian** dari Sheets (backup
      de facto), tapi **lampiran Storage TIDAK bisa** (tidak ada backup
      gratis) -> risiko terbesar.
  - Rekomendasi urut risiko vs biaya (Sheets sync dulu, export manual,
    Supabase Pro, export Storage, Sentry).
  - Checklist pasca-incident.
- `DEPLOYMENT.md`: bagian rollout sekarang merujuk `BACKUP_PROCEDURE.md` +
  daftar migration yang sudah live diperbarui (010, 011, 012).
- Verifikasi: tidak ada perubahan kode -> tsc/eslint/build/test tidak terpengaruh.

---

## PRODUKSI (snapshot Fase 0, untuk konteks)

- 7 forms (semua `form_type=recruitment`, `is_open=false`)
- 240 `form_responses` (239 migrasi + 1 baru), 239 punya key `field_applicant_nim`
- `user_roles` = 0 baris; `selection_results` = 54 baris
- Signup publik aktif (`disable_signup: false`) — **harus dimatikan saat rollout**
- Tidak ada route `/recruitment/[slug]` atau `/admin/recruitments` (klaim dokumen lama salah)

---

## UI OVERHAUL — U1: Fondasi desain (branch `feat/ui-foundation`)

**Status:** selesai, menunggu verifikasi visual di checkpoint U1.

Tujuan (lihat `PROMPT_UI_OVERHAUL_PMK_FORM.md`): membangun sistem desain bersama
yang dipakai semua halaman, responsif mobile-first (Android + iOS), plus
halaman 404/error/loading yang selaras brand. Token warna/font/logo TIDAK
berubah (batasan 1).

### Yang dikerjakan

**Token & global (presentasional, tanpa warna/font baru):**
- `app/layout.tsx`: tambah `export const viewport` — `viewportFit: "cover"`
  (iOS safe-area) + `themeColor: "#F8F6F0"` (sama dengan token `--background`).
- `app/globals.css`: definisi utility `scrollbar-hide` (sebelumnya dead class —
  dipakai di navbar admin + filter landing tapi tidak pernah didefinisikan) dan
  `pt-safe`/`pb-safe` (`env(safe-area-inset-*)`).
- `eslint.config.mjs`: diperbaiki — config lama mengimpor
  `eslint-config-next/core-web-vitals` tanpa ekstensi (Node ESM strict), lalu
  setelah ditambah `.js` ketahuan config Next 15.5 berformat eslintrc warisan
  (`{extends, rules}`), bukan flat config. Solusi: `FlatCompat` dari
  `@eslint/eslintrc` (sudah jadi dependensi eslint, tidak ada dependency baru).
  Hasil: `npx eslint .` akhirnya jalan setelah sekian lama rusak.

**Helper murni (server-safe, unit-tested):**
- `lib/format.ts`: `formatDate` (id-ID, zona WIB via `Intl.DateTimeFormat` —
  konsisten terlepas dari zona server Vercel UTC), `daysUntil` (hari kalender
  WIB), `isPast`, `lastMonths` (bucket bulan + label Indonesia untuk grafik),
  `bucketizeByMonth` (agregasi respons per bulan).
- `lib/form-status.ts`: `getFormStatus()` — SATU sumber label status
  (`not_open`/`open`/`closing_soon`/`closed`). "Aktif" tetap memakai definisi
  tunggal `isFormActive()` dari `lib/forms` (Fase 2-4); file ini hanya
  menerjemahkan ke label + kelas. `CLOSING_SOON_DAYS = 7`.

**Komponen bersama:**
- `components/admin-shell.tsx` + `components/admin-nav.tsx`: navbar admin
  responsif. Desktop: sticky, logo + "PMK Admin" + menu ikon + identitas user +
  Keluar; ada state aktif per-route (`usePathname`, teks accent + latar halus).
  Mobile (<lg): bar ringkas + drawer `Sheet` sisi kiri (keputusan U0-a) berisi
  menu (min-height 44px), identitas user, dan tombol Keluar. Menu Admin & Audit
  Log hanya untuk `super_admin`.
- `components/public-shell.tsx`: header ringan (logo terpusus) + footer untuk
  halaman publik.
- `components/page-header.tsx`, `components/section-card.tsx`,
  `components/stat-card.tsx` (varian `warning` dari token `destructive`),
  `components/badges.tsx` (`StatusBadge` — teks wajib + titik; `CategoryBadge`
  — warna dipetakan dari `FormCard`), `components/empty-state.tsx`,
  `components/segmented-control.tsx`, `components/confirm-dialog.tsx`
  (pengganti `window.confirm()` untuk aksi destruktif),
  `components/responsive-table.tsx` (tabel desktop → daftar kartu di < md),
  `components/skeleton.tsx`, `components/ui/sheet.tsx` (dibangun di atas
  `@radix-ui/react-dialog` — pola resmi shadcn, tanpa dependency baru).

**Halaman state (bagian 6 prompt):**
- `app/not-found.tsx` (404 global, `noindex`, tombol sekunder berbeda untuk
  admin vs publik — ditentukan di server tanpa membocorkan rute admin),
- `app/form/[slug]/not-found.tsx` (pesan aman "tidak ditemukan atau sudah
  ditutup" — tidak membedakan slug salah vs form ditutup, sesuai RLS),
- `app/error.tsx` (root error boundary, pesan generik + `Coba lagi`, hanya log
  digest anonim),
- `app/global-error.tsx` (merender `<html>`+`<body>` sendiri karena bypass
  root layout; inline style karena layout/font di-bypass),
- `app/admin/(dashboard)/not-found.tsx` (404 area admin),
- 403 `Akses Ditolak` di layout admin dipoles pakai token + `<PMKLogo />`
  (logika `getAdminUser()` TIDAK diubah),
- `app/loading.tsx` (root), `app/admin/(dashboard)/loading.tsx`,
  `app/form/[slug]/loading.tsx` — skeleton bermerek menggantikan spinner polos.

**Integrasi:** `app/admin/(dashboard)/layout.tsx` sekarang merender
`<AdminShell>` (navbar lama yang tidak responsif dihapus; logika 403 tetap).

**Tes:** `tests/format.test.ts` + `tests/form-status.test.ts` — 26 tes baru.

### Verifikasi

- `npx tsc --noEmit`: **0 error**.
- `npx eslint app/ components/ lib/ tests/`: **0 error/warning**. (`npx eslint .`
  masih 2 error di `scripts/analyze-bundle.js` — **pre-existing**, bukan file
  U1; `git stash` konfirmasi tidak ada perubahan di file itu.)
- `npm run test:unit`: **69 pass / 0 fail** (43 existing + 26 baru).
- `next build`: **BELUM bisa dijalankan** — butuh env Supabase
  (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`) yang tidak ada di
  environment ini.
- **Verifikasi visual DILAKUKAN** (browser headless via `browser_exec`, viewport
  360/390/768/1024/1440 — `vision_analyze` ditolak model, jadi pakai DOM +
  computed-style assertions + screenshot):
  - **404 global** (`/halaman-tidak-ada`): judul, teks, tombol "Kembali ke
    beranda" + "Lihat formulir" tampil benar; **0 horizontal overflow** di semua
    viewport; judul `Halaman tidak ditemukan — PMK ITERA`.
  - **404 form** (`/form/slug-tidak-ada`): h1 "Formulir tidak ditemukan atau
    sudah ditutup" tampil (pesan aman, tidak membedakan slug salah vs form
    ditutup).
  - **Landing** `/`: h1 "Portal Formulir PMK ITERA", 0 overflow semua viewport.
  - **`/admin/dashboard` tanpa login**: redirect ke `/admin/login` (proxy.ts
    utuh, tidak diubah).
  - **403 "Akses Ditolak"**: tampil benar (layout group + `getAdminUser`,
    logika tidak diubah).
  - **Drawer mobile 360px**: terbuka dengan benar, judul "Menu Admin", 4 menu
    (Dashboard/Formulir/Admin/Audit Log — Admin & Audit Log muncul karena role
    demo super_admin), **tinggi item tepat 44px**, tombol Tutup + Keluar di
    dalam drawer, **0 overflow** saat drawer terbuka.
  - **SegmentedControl**: klik "6 bulan"/"12 bulan" memperbarui
    `aria-checked` dengan benar (role=radiogroup).
  - **ConfirmDialog**: tombol "Hapus (demo konfirmasi)" membuka dialog
    (judul "Hapus formulir?", deskripsi, Batal + Hapus permanen); Batal
    menutup; Hapus permanen menutup + menjalankan handler; **0 overflow**.
  - **ResponsiveTable**: di 360px wrapper tabel `display:none` + kartu mobile
    `display:flex` (5 kartu); di 768px & 1024px kebalikannya (tabel tampil,
    kartu disembunyikan) — breakpoint `md` bekerja.
  - **StatusBadge/CategoryBadge**: semua 5 status + 5 kategori punya TEKS
    (status tidak hanya berbasis warna, sesuai aturan 3.G).
  - `next build` setelah U1: **sukses, 0 error, 15 route**.

### Catatan keamanan

- Semua halaman state memakai pesan generik (tidak ada stack trace, tidak ada
  detail rute/DB). `error.tsx` hanya log `error.digest` (anonim).
- 404 global memutuskan tombol sekunder lewat `getAdminUser()` di server;
  pengguna non-admin hanya melihat tombol publik — tidak ada kebocoran
  keberadaan rute admin.
- 404 form tidak membedakan "slug tidak ada" vs "form ditutup" (RLS mengembalikan
  null untuk keduanya bagi non-admin).
- Otorisasi tidak diubah: `getAdminUser()` di layout, `requireAdmin()` di server
  action, RLS Supabase, dan `proxy.ts` tetap sebagaimana adanya.

### Risiko/regresi

- `AdminShell` menggantikan navbar lama — bila ada halaman admin yang mengandalkan
  class `highlight`/struktur lama, perlu dicek visual di U2.
- `Sheet` (drawer mobile) baru — perlu diuji di HP nyata (buka/tutup, fokus trap,
  tombol Keluar di dalam drawer).
- Rollback: `git revert` commit U1; navbar lama masih ada di `git log`.

---

## UI OVERHAUL — U2: Dashboard + shell admin (branch `feat/ui-admin-dashboard`)

**Status:** selesai (build ✓, tsc ✓, eslint 0 warning, 69 unit test ✓), menunggu
verifikasi visual di checkpoint U2.

Sesuai bagian 3 prompt: dashboard dirombak memakai sistem desain U1
(`PageHeader`, `SectionCard`, `StatCard`, `StatusBadge`/`CategoryBadge`,
`ResponsiveTable`), plus grafik "Respons per periode" yang **sebelumnya kosong**
(kerusakan referensi paling jelas — prompt 0) kini menampilkan data nyata.

### File baru

- `lib/dashboard.ts` — agregasi server-side. Query `form_responses` **hanya
  memilih `submitted_at`** dan query `forms` hanya `open_date, created_at,
  is_deleted` — tidak pernah mengambil `answers`/`files` (batasan 3.E prompt:
  jangan tarik data responden untuk agregasi). Bucketing per bulan kalender
  **WIB** lewat `lastMonths`/`bucketizeByMonth` (`lib/format.ts`), jadi "6 bulan
  terakhir" konsisten terlepas dari zona server (Vercel = UTC). `getTotalResponseCount`
  memakai `count: "exact"` + `head: true`.
- `app/actions/dashboard-chart.ts` — `"use server"` wrapper. **Wajib terpisah**
  dari `lib/dashboard.ts`: client component tidak boleh mengimpor modul yang
  memakai `next/headers` (`createClient`) atau build gagal.
- `components/responses-chart.tsx` — grafik SVG murni, **tanpa dependency baru**
  (prompt 4). Batang = respons (`chart-1` koral), garis+titik = form dibuka
  (`chart-2` teal). Tooltip hover/tap, `<title>`+`<desc>`, tabel `sr-only`,
  empty state jelas saat `total === 0`.
- `components/responses-chart-card.tsx` — client wrapper: `SegmentedControl`
  6/12 bulan + skeleton saat memuat ulang (lewat `useTransition`).

### Perubahan

- `app/admin/(dashboard)/dashboard/page.tsx` — dipakai ulang utuh:
  - Banner peringatan (`3.F`) muncul hanya jika ada form aktif dengan
    `close_date` ≤ 7 hari; nama form dirender sebagai **JSX** (bukan string
    HTML — React escape otomatis), maks 3 + "dan N lainnya".
  - 4 `StatCard` (`3.D`): Formulir aktif, Respons masuk (+N bulan ini, netral
    bila 0/turun), Segera ditutup (varian warning), Kategori dipakai.
  - Grafik (`3.E`) + legenda.
  - Tabel "Formulir terbaru" (`3.G`) memakai `ResponsiveTable` + aksi baris
    `FormQuickActions` (server action existing: Tutup/Buka, Duplikasi, Hapus).
    **Tidak ada tombol palsu** (batasan 3 prompt).
  - `revalidate = 60` (ISR Fase 8-4) dipertahankan.

### Verifikasi

- `npx tsc --noEmit`: 0 error.
- `npx eslint` (4 file): 0 error, 0 warning.
- `npm run test:unit`: 69/69 lulus.
- `npm run build`: sukses, 0 error, 15 route (semua `ƒ` dinamis; dashboard
  tetap server-rendered on demand sesuai `revalidate`).

### Catatan keamanan

- Otorisasi tidak diubah: `getResponseChartData`/`getMonthlyResponseStats`/
  `getTotalResponseCount` memanggil `requireAdmin()`; `getAllForms()` sudah
  memanggilnya. `loadChartAction` mewarisi otorisasi `getResponseChartData`.
- Tidak ada data responden (`answers`) yang diambil untuk grafik.
- Banner hanya mendaftar form yang **aktif** — form tertutup disembunyikan
  (tidak membocorkan form yang sudah berakhir).

### Risiko/regresi

- `getResponseChartData` mengambil SEMUA `submitted_at` dalam rentang lalu
  membucket di JS — pada dataset respons sangat besar (>50rb/bln) query ini
  bisa jadi berat. Opsi bila muncul: SQL `date_trunc` RPC atau `head`+range
  per bulan. Dataset saat ini jauh lebih kecil.
- `forms.open_date` difilter lewat `is_deleted = false`; form sampah
  (soft-delete) tidak dihitung di grafik tapi tetap muncul di `getAllForms`
  (dashboard memakai `isFormActive` untuk filternya sendiri).
- Rollback: `git revert` commit U2; `dashboard/page.tsx` lama ada di `git log`.

---

## UI OVERHAUL — U3: Halaman publik mobile-first (branch `feat/ui-public`)

**Status:** selesai. Verifikasi: tsc ✓, eslint 0 error/warning, 69 unit test ✓,
build ✓ (15 route). Verifikasi visual: landing desktop lolos (Chromium headless
+ analisis gambar), form page mobile lolos, cek overflow horizontal via CDP di
390/768/1280px: **nol di semua viewport**.

### File yang dirombak

**`components/GenericFormRenderer.tsx`** (inti `/form/[slug]` — "halaman
terpenting untuk mobile")
- **Bar aksi bawah sticky** dengan tombol "Kirim Respons" + padding
  `env(safe-area-inset-bottom)` — tidak tertutup keyboard; `pb-44`/`pb-32`
  memberi ruang agar konten terakhir tidak tertutup bar.
- **Indikator progres** (`<Progress>`) saat `settings.show_progress` — menghitung
  hanya bidang wajib agar persentase stabil, `aria-live` untuk pembaca layar.
- **Scroll ke error pertama** + `focus()` saat submit gagal validasi
  (`form.handleSubmit(onSubmit, onInvalid)`).
- **Upload file**: validasi ukuran client-side (10 MB), status eksplisit
  (`Mengunggah…` / `berhasil diunggah` / `gagal diunggah…`), petunjuk
  tipe/ukuran di bawah field.
- **Toast** (bukan `alert()`) untuk error submit/rate limit; tombol submit
  `disabled` saat proses (cegah double submit).
- `redirect_url` tetap dihormati dari `settings` (router.push).
- Logika bisnis TIDAK diubah: skema Zod dinamis, `uploadFormAttachment`,
  `submitFormResponseAction`, Turnstile (`require_captcha !== false`).

**`app/form/[slug]/success/page.tsx`** — dijadikan server component
- Settings (`thank_you_message`, `wa_group_link`) diambil di **server** via
  `getFormBySlug` (RLS berlaku) — sebelumnya query anon client ke tabel `forms`.
- **QR code dihapus** (prompt hanya minta "tombol menonjol"; menghapus
  dependency client berat `react-qr-code` + layout mobile yang sempit).
- **Gerbang "Selesai" dihapus**: dulu tombol kembali disabled sampai user
  centang "sudah gabung grup" — pendaftar bisa terjebak. Sekarang tombol
  "Kembali ke Beranda" selalu aktif.
- Konfirmasi jelas: ikon `CheckCircle2` besar + judul serif + `whitespace-pre-wrap`
  untuk thank_you_message.
- `robots: noindex`.

**`app/page.tsx`** (landing)
- Dibungkus `PublicShell` (header + footer tunggal); footer lokal yang ganda
  dihapus.
- **Hero diringkas** (prompt: "hero ringkas"): logo besar di hero **dihapus**
  karena `PublicShell` sudah menampilkan logo di header — sebelumnya dua logo
  berdekatan dan hero mengisi ±90% tinggi viewport, mendorong kartu formulir
  ke bawah fold. Verifikasi visual konfirmasi: setelah perbaikan, filter chip
  + kartu formulir terlihat tanpa scroll.
- Filter chip: scroll horizontal di mobile (`justify-start` + `overflow-x-auto`),
  terpusat di desktop; `scrollbar-hide` yang tak terdefinisi di config
  DIPERTAHANKAN untuk sementara (kelas utilitas lama, bukan error).
- Empty state ditingkatkan: teks ramah + penjelasan + tautan
  "Lihat semua kategori" saat ada filter kategori aktif.
- Grid: 1 kolom mobile / 2 tablet / 3 desktop (sudah benar sebelumnya).

**`app/form/[slug]/page.tsx`** — dibungkus `PublicShell`; kartu "Form Ditutup"
  tetap netral (batasan 6: tidak membedakan "slug tidak ada" vs "form ditutup").

### `/hasil` (Cek Hasil)

**Tidak ada** — grep di seluruh `app/` dan `components/` tidak menemukan route
maupun tautan `/hasil`. Halaman ini tidak dibuat (prompt menyebutnya "bila
berlaku"). Bila nanti dibutuhkan, pola U3 sudah siap dipakai.

### Verifikasi visual (Catatan: model vision untuk mobile/tablet sempat
gagal — `minimax-m3` EOL; desktop & form-mobile berhasil dianalisis)

- Landing desktop 1280×900: 1 logo, filter + kartu terlihat di fold, footer
  ada, tidak ada overflow/tumpang tindih. Lolos.
- Form page mobile 390×844: header tipis, field satu koloh full-width,
  sticky bar "Kirim Respons", target sentuh ±44–50px, tidak ada overflow. Lolos.
- Overflow horizontal dicek terprogram via CDP:
  `document.documentElement.scrollWidth > window.innerWidth` = **false** di
  390px, 768px, 1280px.

### Catatan keamanan

- Success page: query anon client ke `forms` dihapus — data settings sekarang
  dilindungi RLS server-side.
- Form Ditutup & 404 tetap tidak membocorkan apakah slug ada atau form ditutup.
- Tidak ada server action/RLS/schema yang diubah; submit flow utuh.

### Risiko/regresi

- `GenericFormRenderer` sekarang mengandalkan `<Progress>` + `useToast`
  (kompone UI U1 yang sudah ada). Bila `settings.show_progress` true pada form
  dengan **0 bidang wajib**, indikator disembunyikan (guard
  `requiredFieldIds.length > 0`).
- Sticky bar memakai `form="main-form"` — tombol submit di luar `<form>`;
  FITUR INI butuh browser modern (semua browser target 2026 mendukungnya).
- Rollback: `git revert` commit U3 (2 commit).
