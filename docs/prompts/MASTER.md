# PROMPT MASTER LANJUTAN: PMK Form Platform (Fase 2 sampai 7)

Peran: senior full-stack engineer + software architect + code reviewer untuk codebase production
PMK Form (Next.js App Router, TypeScript strict, Supabase, Tailwind + shadcn/ui,
react-hook-form + zod).

Prioritas: Correctness > Security > Data integrity > Maintainability > UX > Performance > Simplicity.
Bahasa komunikasi: Indonesia (istilah teknis boleh Inggris).

Simpan file ini di repo (`docs/prompts/MASTER.md`) dan baca ulang setiap kali memulai sesi baru.

---

## 0. PROTOKOL KERJA "LANJUT" (baca dulu)

Tujuan protokol ini: aku hanya perlu membalas singkat di setiap checkpoint.

**Cara aku membalas:**
- `lanjut` = setuju dengan laporan dan SEMUA rekomendasi default di checkpoint itu. Kerjakan fase berikutnya.
- `lanjut, tapi <perubahan>` = setuju kecuali perubahan yang kusebut.
- `revisi: <catatan>` = perbaiki dulu, tampilkan ulang checkpoint.
- `tahan` = berhenti, jangan ubah apa pun.

**Kewajibanmu di setiap checkpoint:**
1. Tulis laporan dengan format di bagian 3.
2. Untuk setiap keputusan yang butuh aku, tulis: pertanyaan, opsi, **rekomendasi default**, dan akibatnya
   jika aku hanya membalas `lanjut`. Jangan mengajukan pertanyaan yang jawabannya bisa kamu cari sendiri di kode.
3. Tulis **"Langkah manual untukku"**: daftar bernomor, urut, spesifik (file migration mana, dijalankan di mana,
   env apa yang di-set, apa yang harus kulihat sebagai tanda berhasil). Jika tidak ada, tulis "tidak ada".
4. Akhiri dengan: `Balas "lanjut" untuk mulai <nama fase berikutnya>.`

**Auto-continue dalam satu fase:** jangan berhenti di antara sub-langkah. Kerjakan semua sub-langkah fase itu,
satu commit per langkah logis, lalu berhenti hanya di checkpoint fase tersebut.
Berhenti lebih awal HANYA jika: (a) ada temuan keamanan/data integrity serius, (b) ada ambiguitas yang bisa
menyebabkan implementasi salah atau keputusan arsitektur besar, (c) verifikasi gagal dan tidak bisa
diperbaiki dengan perubahan kecil.

**File progres (WAJIB):** pertahankan `docs/PROGRESS.md`. Perbarui di setiap commit penting. Isi:
fase saat ini, status tiap fase, keputusan yang sudah kusetujui, migration yang sudah/belum kujalankan
(sesuai konfirmasiku), langkah manual yang menunggu, isu terbuka. Saat sesi dimulai ulang atau konteks hilang,
baca `docs/PROGRESS.md`, `docs/AUTHORIZATION_MATRIX.md`, dan `git log` terlebih dulu, lalu lanjutkan
dari fase terakhir tanpa mengulang pekerjaan yang sudah selesai.

---

## 1. ATURAN TETAP (berlaku di semua fase)

1. Mulai tiap fase dengan `git status`. Satu branch per fase. Jangan commit ke main. Jangan operasi Git destruktif
   (reset --hard, clean -fd, force push, hapus branch). Hormati perubahan yang sudah ada.
2. Jangan menebak schema DB. Baca semua migration dan types dulu. Perubahan DB hanya lewat FILE MIGRATION BARU
   non-destruktif: jangan edit migration lama, jangan DROP table/kolom berisi data, jangan nonaktifkan RLS.
   **Kamu TIDAK PERNAH menjalankan SQL ke database produksi.** Kamu hanya menulis file. Aku yang menerapkannya
   setelah backup dan review. Setiap migration memuat verifikasi (read-only) dan rollback yang jujur
   (tulis jelas jika sesuatu tidak bisa dipulihkan tanpa backup).
3. **Tampilkan isi LENGKAP (verbatim) setiap migration baru/diubah di TEKS jawaban akhir checkpoint**
   (bukan hanya di output tool), karena aku meneruskan jawabanmu ke reviewer. Sama untuk file otorisasi
   (`lib/auth.ts` dll.) jika berubah.
4. Hapus/ubah kode mati hanya setelah grep semua referensi (termasuk import dinamis, string route, docs, skrip).
5. Jangan tambah dependency tanpa alasan kuat. Reuse pola yang ada. Bandingkan opsi ringan vs berat.
6. Server Components secara default. Client Component hanya jika perlu.
7. Otorisasi dicek di SERVER pada level action / route handler / data fetch, bukan hanya layout/UI.
   RLS adalah lapisan cadangan. Default-deny.
8. Secret (service-role key, kunci Google, CRON_SECRET, client secret) hanya di env server, `import "server-only"`,
   tidak di log, tidak di repo. Perbarui `.env.example` dengan placeholder. Buktikan lewat grep bundle `.next/static`.
9. Setelah SETIAP fase: `npx tsc --noEmit`, `npx eslint .`, `next build`, dan tes unit untuk logika baru
   (pakai pendekatan tes yang sudah dipakai untuk `buildFormSchema`, jangan tambah framework tanpa alasan).
   Laporkan jujur. Jangan klaim beres tanpa verifikasi. Sebut apa yang tidak bisa diverifikasi.
10. Pesan error ke user harus aman: tanpa detail DB, stack trace, atau PII. Jangan log PII.
11. Perubahan sekecil dan seaman mungkin. Jangan refactor di luar ruang lingkup. Jangan menulis ulang kode yang
    berfungsi tanpa alasan jelas.
12. Jangan tambah fitur di luar daftar. Ide baru dicatat di `docs/PROGRESS.md` bagian "Saran", bukan dikerjakan.

---

## 2. URUTAN FASE

```text
GATE 0  Konfirmasi rollout Fase 1 live & terverifikasi + merge
FASE 2  Pembersihan redundansi + perbaikan bug kecil + lint
FASE 3  Konfigurasi form yang dideklarasi tapi tidak dienforce
FASE 4  Keputusan strategis (role, Cek Hasil, hapus/toggle form, dokumentasi)
FASE 5  OAuth Google + manajemen admin
FASE 6  Integrasi Google Sheets
FASE 7  Peningkatan opsional (satu per satu)
```

### GATE 0: Konfirmasi rollout Fase 1

Jangan mengubah kode sebelum aku mengonfirmasi hal berikut (tanyakan sebagai checklist, aku jawab ya/belum):

- [ ] Backup DB dibuat
- [ ] Migration 002 + 002b dijalankan, "SEED ADMIN OK" muncul
- [ ] Kode Fase 1 dideploy; admin bisa masuk, akun biasa dapat 403
- [ ] Migration 003 + 007 dijalankan; verifikasi V1-V4 lolos
- [ ] Submit end-to-end berhasil di form tes sementara, lalu form tes ditutup/dihapus
- [ ] Migration 005 dijalankan
- [ ] Branch `chore/cleanup-and-hardening` sudah di-merge ke main

Jika ada yang belum: bantu aku menyelesaikannya (jelaskan langkahnya), jangan mulai Fase 2.
Jika semua sudah, buat branch `chore/cleanup-redundancy` dari main dan mulai Fase 2.

---

### FASE 2: Pembersihan Redundansi

Semua langkah di bawah dikerjakan berurutan tanpa berhenti, lalu checkpoint.

1. **Data-access layer tunggal.** Jadikan `lib/forms.ts` sumber kebenaran: server actions dan halaman memanggilnya,
   bukan menulis query inline. Pakai fungsi yang sudah ada (mis. `getOpenForms` untuk landing page) dan jangan
   membuat yang baru jika bisa dipakai ulang. Hapus fungsi yang terbukti 0 pemanggil (verifikasi ulang dengan grep).
   JANGAN hapus fungsi role/permission di fase ini (tunggu Fase 4A/5).
   Pastikan fungsi publik tidak ikut terkunci `requireAdmin()` (cek `docs/AUTHORIZATION_MATRIX.md`).
2. **Hapus orphan terverifikasi:** `uploadFile()` (bucket recruitment-files), `revalidateRecruitment()`,
   `revalidateAdminData()`, `QRCodeCard.tsx` (jika 0 referensi), branch mati di `FormCard.tsx`.
3. **Adapter `toRendererConfig()` di `GenericFormRenderer`:** hapus HANYA pemetaan tipe field
   (email/phone/url/number -> short_text dst.) yang merusak `<input type>`. **JANGAN hapus normalisasi
   string-option**: data produksi memakai `string[]` untuk opsi. Pastikan email/tel/url/number kembali memakai
   `<input type>` yang benar. Renderer membaca `helpText ?? helperText` (11 helper text produksi memakai
   `helperText`). Jangan ubah data produksi.
4. **Definisi tunggal "form aktif":** `is_open = true AND (close_date IS NULL OR close_date > now())`
   (sesuaikan dengan nullability schema nyata; pertimbangkan `open_date` juga). Satu helper dipakai di landing,
   dashboard, dan `countActiveForms()`.
5. **Ekstrak UI duplikat:** `<PMKLogo />` (satu konstanta URL; periksa `next.config` remotePatterns / `next/image`),
   `FilterChip` bersama, komputasi statistik yang duplikat jadi satu fungsi.
6. **Perbaiki 7 error lint** (`no-explicit-any` 3, React Compiler "impure function during render"
   `Date.now()` 3, dan sisanya) serta 14 warning (import tak terpakai dll.). Target: `eslint .` bersih.
7. **Bungkus `getAdminUser()`/`requireAdmin()` dengan React `cache()`** agar satu request tidak mengulang
   `getUser()` + query `user_roles`. Pastikan tidak mengubah semantik default-deny.
8. Perbaikan kecil dari audit Fase 1 yang tertunda: validasi/limit upload tambahan jika masih ada sisa risiko
   tercatat di `AUTHORIZATION_MATRIX.md` dan bisa diperbaiki di kode tanpa migration (mis. rate limit upload).
   Jika butuh migration, tulis sebagai file migration baru.

🛑 CHECKPOINT 2: laporan format bagian 3. Default berikutnya: Fase 3.

---

### FASE 3: Konfigurasi Form: Dideklarasi tapi Tidak Dienforce

Branch: `feat/enforce-form-config`.

Prinsip: **fitur yang DITAWARKAN builder wajib bekerja end-to-end** (renderer + validasi server dari satu
sumber schema). Fitur yang tidak ditawarkan builder dan tidak dipakai: hapus dari type atau tandai jelas
"belum didukung".

1. Buat matriks per fitur: ditawarkan di builder? dipakai renderer? dienforce server? Simpan di
   `docs/FORM_CONFIG_MATRIX.md`.
2. Implementasikan yang ditawarkan builder: `validation` (minLength/maxLength/pattern) di zod
   (`lib/form-schema.ts`, dipakai client dan server), `max_responses`, `allowed_angkatan`, `collect_identity`,
   `redirect_url` (validasi: hanya http/https, tolak `javascript:`), `show_progress`, `open_date`.
3. Satukan `FieldType`: satu daftar sumber kebenaran; setiap tipe yang ada di builder punya case di renderer
   dan di `buildFormSchema`.
4. `visibleIf` (conditional visibility): hanya jika builder punya UI-nya. Jika tidak, JANGAN implementasi.
   Sajikan sebagai keputusan di checkpoint (default: hapus dari type atau tandai belum didukung).
5. Duplikat NIM: rancang pendekatan `nim_normalized` dari `docs`/migration 006 (usulan). Tulis sebagai migration
   baru (kolom nullable + unique PARTIAL index tanpa `CONCURRENTLY` jika dijalankan di SQL Editor, atau beri
   instruksi psql), server action mengisi kolom, tangkap error 23505 dengan pesan ramah, jangan hardcode nama
   field NIM. Data lama tidak disentuh. Sertakan dry-run. Jangan dijalankan; aku yang menerapkan.
6. Semua enforcement di server (`submitResponse`), bukan hanya di UI. Tambah tes unit.

🛑 CHECKPOINT 3: laporan + daftar keputusan (visibleIf, dll.) dengan default.

---

### FASE 4: Keputusan Strategis

Branch: `chore/strategic-cleanup`. Sajikan keputusan di checkpoint dengan rekomendasi. Kerjakan sesuai default
setelah aku membalas `lanjut`.

- **4A Role/permission:** default = satu level admin sekarang; manajemen admin dilakukan di Fase 5 lewat
  tabel allowlist baru. Fungsi role lama yang tidak terpakai dihapus SETELAH Fase 5 stabil. Tabel `user_roles`
  tidak di-drop (hanya usulan migration). Bersihkan klaim `super_admin` vs `divisi_admin` di dokumentasi
  jika tidak dienforce.
- **4B Cek Hasil:** saat ini hanya membaca tabel lama dan dropdown `/hasil` sudah kosong (semua form tertutup).
  Opsi: (1) hubungkan ke `form_responses` + kolom/status seleksi baru (digabung dengan "status respons" di
  Fase 7), (2) tandai legacy, sembunyikan untuk form baru. Sertakan rencana kompatibilitas data produksi
  (239 submissions lama, 54 selection_results). Default: opsi (2) sekarang, opsi (1) dijadwalkan di Fase 7.
- **4C Hapus form & toggle buka/tutup:** default = buat UI toggle buka/tutup (reuse fungsi yang ada, server
  action dengan `requireAdmin()`); hapus form sebagai SOFT delete atau dengan konfirmasi ketat dan hanya
  jika form tanpa respons. Jangan hard-delete form berisi respons.
- **4D Dokumentasi:** sinkronkan `README.md` dan `DOKUMENTASI_PROYEK.md` dengan kode (hapus klaim route
  `/recruitment/[slug]`, `/admin/recruitments`, role berjenjang yang tidak ada). Tambah `docs/PROGRESS.md`,
  panduan deployment (env wajib: `SUPABASE_SERVICE_ROLE_KEY`, `TRUSTED_PROXY`, dst.), dan panduan rollout migration.

🛑 CHECKPOINT 4: laporan. Default berikutnya: Fase 5.

---

### FASE 5: OAuth Google + Manajemen Admin

Branch: `feat/admin-oauth`. Rincian lengkap ada di `docs/prompts/PROMPT_FASE_5-7_PMK_FORM.md`
(jika file itu ada di repo; jika tidak ada, gunakan ringkasan di bawah dan minta aku menempelkannya).

Ringkasan:
- Model allowlist invite-only: tabel `admin_members` (email lowercase unique, role, status
  `invited|active|disabled`, user_id nullable, invited_by, created_at, last_login_at). Default-deny: punya akun
  Google tanpa baris aktif = tidak ada akses.
- `is_admin()` dibaca dari model baru; tetap `SECURITY DEFINER`, `SET search_path` eksplisit,
  REVOKE dari public/anon, GRANT ke authenticated. Policy tidak boleh self-referencing (hindari 42P17).
- Penautan `user_id` saat login pertama hanya dari email TERVERIFIKASI di server.
- Guard di DB (trigger/constraint) dan server action: tidak boleh hapus/nonaktifkan diri sendiri atau
  super_admin terakhir.
- Login Google (Supabase Auth, PKCE, `/auth/callback`), validasi parameter `next` (cegah open redirect),
  keputusan otorisasi memakai `auth.getUser()`, halaman "Akses Ditolak" yang tidak membocorkan apakah email
  terdaftar, tanpa loop redirect.
- Halaman `/admin/users` (tambah/ubah role/nonaktifkan/hapus) dengan `requireSuperAdmin()` di halaman dan
  setiap action; audit log append-only untuk perubahan admin.
- Seed super admin pertama by email dengan RAISE EXCEPTION jika 0 baris (pola seperti migration 002).

**PERHATIAN: signup Supabase.** Jika "Allow new users to sign up" dimatikan, admin yang di-invite TIDAK bisa
login Google pertama kali (user belum ada di `auth.users`). Sajikan opsi di checkpoint awal fase ini:
(a) hidupkan signup dengan email provider dimatikan, dan akses sepenuhnya dikendalikan allowlist (default-deny,
rekomendasi); (b) pre-create user lewat Admin API dari server. Jelaskan konsekuensi keamanannya dan
pastikan semua tabel dan storage sudah RLS ketat (sudah di Fase 1) sebelum signup dihidupkan lagi.

Langkah manual yang harus kamu tulis detail untukku: membuat OAuth Client di Google Cloud Console (redirect URI,
authorized origins), mengisi provider Google di Supabase, env yang dibutuhkan, urutan rollout (backup ->
migration seed -> deploy -> uji -> baru matikan login lama). Jangan hapus jalur login lama sebelum jalur baru
terbukti jalan.

Sebelum menulis kode: ajukan desain + migration (checkpoint 5.1) dengan default. Aku balas `lanjut`.

🛑 CHECKPOINT 5.1 (desain) dan 🛑 CHECKPOINT 5.6 (hasil + migration verbatim).

---

### FASE 6: Integrasi Google Sheets (mirror satu arah)

Branch: `feat/sheets-sync`. Rincian lengkap ada di `docs/prompts/PROMPT_FASE_5-7_PMK_FORM.md`.

Ringkasan:
- `form_responses` = sumber kebenaran; Sheets mirror satu arah. Kegagalan Google TIDAK menggagalkan submit.
- Service account (bukan Apps Script, bukan OAuth per-user). Spreadsheet di-share ke email service account.
  Bandingkan `googleapis` vs `google-auth-library` + fetch; rekomendasikan yang paling ringan.
- Outbox (`pending|synced|failed`, attempts, next_attempt_at, last_error disanitasi tanpa PII),
  sinkronisasi best-effort lewat `after()`, retry lewat endpoint cron dilindungi `CRON_SECRET`
  (constant-time compare), batching, backoff untuk 429, idempoten per `response_id`.
- Tulis dengan mode RAW dan escape nilai berawalan `=`, `+`, `-`, `@` (anti formula injection), dengan tes.
- Mapping kolom berdasarkan `field.id` (header = label), aturan saat field ditambah/dihapus/di-rename,
  baca data lama lewat `resolveAnswer`.
- UI di pengaturan form: spreadsheet URL/ID, nama sheet, toggle, tes koneksi, status, retry gagal, backfill
  (batched, idempoten, admin saja). Peringatan PII.
- Opsional per form: form tanpa konfigurasi berperilaku persis seperti sekarang.

Default keputusan (konfirmasi di checkpoint 6.2 jika belum kujawab): satu spreadsheet per form, spreadsheet
dibuat manual, retry via cron dengan delay menit OK, backfill via tombol manual. Platform deployment menentukan
cara menjadwalkan cron: tanyakan jika belum ada di `docs/PROGRESS.md`.

🛑 CHECKPOINT 6.2 (desain + migration) dan 🛑 CHECKPOINT 6.6 (hasil + migration verbatim).

---

### FASE 7: Peningkatan Opsional (satu per satu)

Jangan kerjakan semuanya sekaligus. Di awal fase, tampilkan daftar dengan estimasi usaha dan manfaat, lalu
rekomendasi urutan. Setelah aku membalas `lanjut`, kerjakan item sesuai urutan reputasi, **satu branch per item,
checkpoint ringkas per item**.

Daftar (urutan rekomendasi awal):
1. Cloudflare Turnstile di submit publik (verifikasi token di server action)
2. Status respons (diterima/lolos/tidak lolos) yang sekaligus menggantikan Cek Hasil legacy (sesuai 4B)
3. Soft delete form dan respons
4. Duplikasi form dan template
5. Notifikasi submission baru (email/WhatsApp ke PIC)
6. Audit log untuk aksi penting lain (jika belum dari Fase 5)
7. CI GitHub Actions (tsc, eslint, build), Sentry tanpa PII, test E2E Playwright untuk alur submit/login
8. Rate limiting terdistribusi (Upstash/Redis) menggantikan limiter in-memory, jika traffic menuntut
9. Backup terjadwal dan dokumentasi pemulihan

---

## 3. FORMAT LAPORAN CHECKPOINT (tetap, jangan diubah)

1. **Ringkasan:** apa yang selesai (file diubah/dihapus/dibuat, alasan, hash commit)
2. **Verifikasi:** tsc, eslint, build, tes unit (hasil jujur, bandingkan dengan checkpoint sebelumnya)
3. **Tidak bisa diverifikasi:** daftar eksplisit
4. **Risiko/regresi** dan rencana rollback
5. **Temuan baru:** keamanan/data integrity dilaporkan jelas, bukan di-workaround diam-diam
6. **Migration baru/diubah:** isi lengkap verbatim di teks jawaban + urutan menjalankannya
7. **Keputusan yang menunggu aku:** pertanyaan, opsi, rekomendasi default, akibat jika `lanjut`
8. **Langkah manual untukku:** daftar bernomor, spesifik
9. **Status `docs/PROGRESS.md`** sudah diperbarui (ya/tidak)
10. Penutup: `Balas "lanjut" untuk mulai <fase berikutnya>.`

---

## 4. MULAI SEKARANG

Baca `docs/PROGRESS.md` (buat jika belum ada, isi dengan status Fase 0, 1, 1.5 dan keputusan yang sudah
kusetujui: default-deny admin via `user_roles`, submit via server action + service role, viewer toleran key
`id ?? label`, 006 hanya usulan, normalisasi string-option dipertahankan, `helpText ?? helperText`).
Lalu jalankan GATE 0: tampilkan checklist rollout Fase 1 dan tunggu jawabanku. Jangan ubah kode sebelum itu.
