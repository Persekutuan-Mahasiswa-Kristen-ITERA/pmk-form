# TUGAS: Pengembangan Fitur PMK Form Platform (Fase 5–7)

Peran: senior full-stack engineer + software architect + code reviewer untuk codebase production
PMK Form (Next.js App Router, TypeScript strict, Supabase, Tailwind + shadcn/ui,
react-hook-form + zod).

Prioritas: Correctness > Security > Data integrity > Maintainability > UX > Performance > Simplicity.

Bahasa komunikasi denganku: Indonesia (istilah teknis boleh Inggris).

## PRASYARAT

Prompt ini hanya dijalankan SETELAH Fase 0–4 (audit, hardening, pembersihan, enforcement
konfigurasi form, keputusan strategis) selesai dan kusetujui. Hasil Fase 4A (nasib role system
`super_admin` / `divisi_admin`) menentukan desain Fase 5. Jika belum ada keputusan 4A,
berhenti dan tanyakan.

Jika ada hal yang ambigu di prompt ini, JANGAN menebak. Tanyakan dan minta konfirmasi di
checkpoint terdekat.

## ATURAN KERJA (WAJIB, berlaku di semua fase)

1. Mulai dengan `git status`. Buat branch baru per fase (`feat/admin-oauth`, `feat/sheets-sync`, dst).
   Jangan commit ke main. Satu commit per langkah logis dengan pesan jelas.
2. Jangan operasi Git destruktif (reset --hard, clean -fd, force push, hapus branch).
3. Jangan menebak schema DB. Baca semua migration dan types DB terlebih dulu.
4. Semua perubahan DB lewat FILE MIGRATION BARU yang non-destruktif. Jangan edit migration lama,
   jangan DROP table/kolom, jangan nonaktifkan RLS. Tulis file migration saja. JANGAN menjalankan
   SQL apa pun ke database produksi. Aku yang menerapkannya setelah review dan backup.
   Setiap migration wajib menyertakan SQL rollback di komentar.
5. Jangan tambah dependency baru tanpa alasan kuat. Bandingkan opsi ringan vs berat dan jelaskan.
6. Server Components secara default; Client Component hanya jika perlu.
7. Setelah SETIAP fase jalankan: `npx tsc --noEmit`, `npx eslint .`, dan `next build`. Laporkan jujur.
   Jangan klaim "sudah beres" tanpa verifikasi; sebut apa yang tidak bisa diverifikasi.
8. Berhenti dan TANYA AKU di setiap CHECKPOINT (🛑). Jangan memutuskan sendiri.
9. Jangan refactor di luar ruang lingkup. Perubahan sekecil dan seaman mungkin.
10. Jangan pernah mengekspos secret (service-role key, service account key, client secret OAuth,
    CRON_SECRET) ke client, log, atau repo. Semua secret hanya di env server. Berikan template
    `.env.example` dengan placeholder.
11. Semua modul yang memakai secret wajib `import "server-only"`. Buktikan dengan grep pada
    `.next/static` bahwa tidak ada secret yang bocor ke bundle client.
12. Otorisasi dicek di SERVER pada level action / route handler / data fetch, bukan hanya di layout
    atau UI. RLS adalah lapisan cadangan, bukan satu-satunya lapisan.
13. Hal-hal yang harus kulakukan manual (Google Cloud Console, dashboard Supabase, env deployment)
    ditulis sebagai panduan langkah demi langkah di laporan. Jangan berasumsi sudah dilakukan.

## CHECKPOINT 5.0: KEPUTUSAN AWAL (tanya aku sebelum menulis kode)

Sajikan pertanyaan berikut dengan rekomendasi default. Jika aku tidak menjawab suatu poin,
konfirmasi dulu default-nya sebelum dipakai.

| # | Pertanyaan | Rekomendasi default |
|---|------------|---------------------|
| 1 | Sheets: satu spreadsheet per form, atau satu spreadsheet dengan satu tab per form? | Satu spreadsheet per form (isolasi akses lebih mudah) |
| 2 | Sinkronisasi: boleh delay beberapa menit saat retry, atau harus nyaris real-time? | Percobaan pertama langsung setelah submit, retry via cron (delay menit OK) |
| 3 | Spreadsheet dibuat manual (ID dimasukkan di builder) atau dibuat otomatis oleh aplikasi? | Manual (otomatis butuh scope Drive, lebih rumit) |
| 4 | Backfill respons lama (±240 data) ke sheet diperlukan? | Ya, lewat tombol manual, batched dan idempoten |
| 5 | Login: Google saja, atau email/password tetap ada sebagai akses darurat? | Google saja setelah terverifikasi, email/password dipertahankan sementara selama masa transisi |
| 6 | Akun Google mana yang boleh di-invite: bebas atau dibatasi domain? | Bebas, tapi hanya yang ada di allowlist (default-deny) |
| 7 | `divisi_admin` dienforce (admin hanya melihat form divisinya) atau satu level admin dulu? | Ikuti keputusan Fase 4A |
| 8 | Platform deployment (Vercel / VPS / lainnya)? | Tanyakan. Menentukan cara menjalankan cron/background job |

Jangan lanjut ke Fase 5 sebelum poin 5–8 terjawab. Jangan lanjut ke Fase 6 sebelum poin 1–4 dan 8 terjawab.

---

## FASE 5: OAuth Login + Manajemen Admin

Tujuan: login memakai Google OAuth, dan super admin bisa menambah, menonaktifkan, atau menghapus
admin tanpa menyentuh database manual.

### 5.1 Discovery (tanpa mengubah kode)
- Baca ulang `lib/auth.ts`, `proxy.ts`, layout admin, halaman `/admin/login`, tabel `user_roles`,
  fungsi `is_admin()`, dan semua RLS yang memakainya.
- Petakan semua tempat yang bergantung pada `user_roles` / `is_admin()`.
- Laporkan rencana migrasi dari `user_roles` ke model baru (atau perluasan `user_roles`) dengan
  opsi, trade-off, dan rekomendasi. Pilih yang paling sederhana. `user_roles` tidak boleh di-drop.
🛑 CHECKPOINT 5.1: tunggu persetujuan desain.

### 5.2 Model otorisasi: allowlist, invite-only
- Tabel `admin_members`: `id`, `email` (disimpan lowercase, unique), `role`, `status`
  (`invited | active | disabled`), `user_id` (nullable, ditautkan saat login pertama),
  `invited_by`, `created_at`, `last_login_at`.
- Default-deny tetap berlaku: punya akun Google saja TIDAK memberi akses apa pun. Harus ada baris
  allowlist dengan status aktif.
- `is_admin()` (dan helper role jika dipakai) dibaca dari model baru. Tetap `SECURITY DEFINER`,
  `SET search_path` eksplisit, `REVOKE EXECUTE` dari `public/anon`, `GRANT` hanya ke `authenticated`.
- Penautan `user_id` saat login pertama dilakukan di server, hanya berdasarkan email yang
  TERVERIFIKASI (klaim `email_verified` dari token/`auth.getUser()`). Jangan percaya data dari client,
  termasuk parameter `hd`.
- RLS `admin_members`: hanya super_admin yang boleh INSERT/UPDATE/DELETE. User boleh membaca
  barisnya sendiri.
- Guard integritas di DB (trigger/constraint) DAN di server action: tidak boleh menghapus atau
  menonaktifkan diri sendiri, tidak boleh menghapus atau menurunkan super_admin terakhir.
- Pertimbangkan `admin_audit_log` (siapa menambah/menghapus/mengubah admin, kapan). Append-only,
  hanya bisa dibaca super_admin.
- Seed super_admin pertama memakai email, bukan UUID:
  `insert into ... select id, ... from auth.users where email = 'GANTI@EMAIL';`
  Berikan template dengan placeholder. Aku yang mengisi email.

### 5.3 Alur login Google
- Supabase Auth provider Google dengan PKCE. Route `/auth/callback` menukar code menjadi session.
- Validasi parameter redirect/`next` (hanya path internal, cegah open redirect).
- Di server pakai `auth.getUser()` (bukan `getSession()`) untuk keputusan otorisasi.
- Pengguna Google yang tidak ada di allowlist atau berstatus disabled: tampilkan halaman
  "Akses Ditolak" yang aman (tanpa bocor info apakah email terdaftar), dan sediakan tombol logout.
- Menonaktifkan atau menghapus admin harus berlaku pada request berikutnya (karena pengecekan
  per request + RLS). Jelaskan apakah perlu revoke session tambahan dan bagaimana caranya.
- Jangan membuat loop redirect antara `/admin/login` dan halaman 403.
- Tombol login email/password: ikuti keputusan #5. Jika dipertahankan sementara, tetap wajib lolos
  allowlist.

### 5.4 Halaman `/admin/users`
- Server Component dengan `requireSuperAdmin()` di level halaman DAN setiap server action.
- Fitur: daftar admin (email, role, status, last login), tambah (invite) email, ubah role,
  nonaktifkan/aktifkan, hapus. Konfirmasi untuk aksi destruktif.
- Validasi email di server (zod), normalisasi lowercase, cegah duplikat.
- Pakai komponen shadcn/ui yang sudah ada. Loading, empty, error, dan success state lengkap.
  Responsif (mobile + desktop).
- Pesan error aman untuk user, tanpa detail DB.

### 5.5 Urutan rollout (WAJIB berurutan, tulis di laporan beserta rollback)
1. Backup DB.
2. Aku membuat OAuth Client di Google Cloud Console dan mengisi provider Google di Supabase
   (berikan panduan lengkap: redirect URI, authorized origins, env yang diperlukan).
3. Aku menjalankan migration (tabel + `is_admin()` baru + seed email super admin).
4. Deploy kode. Uji: super admin bisa login Google dan membuka `/admin/*`; akun Google acak
   melihat "Akses Ditolak"; admin yang dinonaktifkan kehilangan akses.
5. Setelah terverifikasi, nonaktifkan jalur email/password sesuai keputusan #5.
Jangan hapus jalur login lama sebelum jalur baru terbukti jalan di produksi.

### 5.6 Verifikasi Fase 5
tsc, eslint, build, unit test untuk guard (self-delete, last super_admin, normalisasi email,
validasi redirect). Daftar lengkap server action/route/halaman admin beserta status
`requireAdmin()` / `requireSuperAdmin()` / publik. Sebutkan yang tidak bisa diverifikasi.
🛑 CHECKPOINT 5.6: laporkan hasil, tampilkan isi lengkap migration dan `lib/auth.ts` terbaru
untuk kureview sebelum kuterapkan.

---

## FASE 6: Integrasi Google Sheets (mirror satu arah)

Tujuan: setiap submission baru otomatis muncul di Google Spreadsheet.

### 6.1 Prinsip desain
- `form_responses` tetap SUMBER KEBENARAN. Sheets hanya mirror satu arah. Edit di sheet tidak
  mengalir balik.
- Kegagalan Google API TIDAK BOLEH menggagalkan submit pendaftar.
- Pendekatan: Google Sheets API dengan SERVICE ACCOUNT (bukan Apps Script webhook, bukan OAuth
  per-user). Spreadsheet di-share ke email service account sebagai Editor. Integrasi ini
  independen dari OAuth login.
- Bandingkan opsi library: `googleapis` (berat) vs `google-auth-library` + REST/fetch (ringan).
  Rekomendasikan yang paling ringan yang masih maintainable, dan jelaskan alasannya.
- Env server: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (tangani format `\n`),
  `CRON_SECRET`. Semua `server-only`, tidak ada di client/log.

### 6.2 Discovery & desain (tanpa ubah kode)
- Baca `submitResponse.ts`, `lib/form-schema.ts`, `GenericResponseTable.tsx` (`resolveAnswer`),
  builder form, dan tipe `FormSettings`.
- Ajukan desain: tabel konfigurasi per form (`spreadsheet_id`, `sheet_name`, `enabled`,
  urutan kolom berdasarkan `field.id`), dan tabel outbox sinkronisasi.
🛑 CHECKPOINT 6.2: tunggu persetujuan desain dan migration.

### 6.3 Outbox + sinkronisasi
- Tabel outbox: `response_id` (unique), `form_id`, `status` (`pending | synced | failed`),
  `attempts`, `next_attempt_at`, `last_error` (sudah disanitasi, tanpa PII/secret), `synced_at`.
  RLS: hanya admin (atau service-role dari server).
- Alur: `submitResponse` menyimpan response + menambah baris outbox (murah, satu request), lalu
  sinkronisasi best-effort setelah response dikirim ke user (`after()` Next.js atau mekanisme
  setara di platform deployment). Error di tahap ini hanya mengubah status outbox.
- Retry berkala lewat endpoint cron (mis. `/api/cron/sheets-sync`) yang dilindungi `CRON_SECRET`
  (perbandingan constant-time), plus exponential backoff dan batas percobaan. Cara menjadwalkan cron
  mengikuti keputusan #8.
- Idempotensi: simpan `response_id` di kolom tersembunyi/terakhir dan cegah baris ganda saat
  retry. Jelaskan mekanismenya.
- Kuota: batch beberapa baris dalam satu panggilan `append`, tangani 429 dengan backoff.
- Tulis nilai dengan mode yang tidak mengevaluasi formula (`RAW`), DAN tetap escape nilai yang
  diawali `=`, `+`, `-`, `@` untuk mencegah spreadsheet/formula injection. Buktikan dengan tes.
- Mapping kolom berdasarkan `field.id`, header = label field saat ini. Aturan perubahan form:
  field ditambah → kolom baru di kanan; field dihapus → kolom dipertahankan; field di-rename →
  hanya header diperbarui; data lama berkey label tetap terbaca lewat `resolveAnswer`.
- Jangan menulis PII ke log. `last_error` tidak boleh memuat isi jawaban.

### 6.4 UI di admin
- Di pengaturan form: input spreadsheet URL/ID (parse ID dari URL), nama sheet, toggle aktif,
  tombol "Tes koneksi" (menampilkan pesan jelas jika sheet belum di-share ke service account,
  beserta email service account yang harus ditambahkan), dan status sinkronisasi
  (jumlah pending/failed, waktu sinkron terakhir).
- Tombol "Coba ulang yang gagal" dan "Sinkronkan semua respons yang ada" (backfill): batched,
  idempoten, rate-limited, hanya admin, dengan progres/hasil yang jelas.
- Semua server action di sini memakai `requireAdmin()`.
- Peringatan UI bahwa spreadsheet berisi PII (NIM, email, nama) dan akses sheet harus dibatasi.

### 6.5 Rollout
1. Backup DB.
2. Aku membuat Google Cloud project + service account + mengaktifkan Sheets API, lalu mengisi env
   (berikan panduan lengkap).
3. Aku menjalankan migration.
4. Deploy. Uji dengan form tes dan spreadsheet tes berisi data DUMMY (jangan data produksi).
5. Aktifkan per form, lalu backfill jika diperlukan.
Sheets adalah fitur opsional per form. Form tanpa konfigurasi harus berperilaku persis seperti
sekarang.

### 6.6 Verifikasi Fase 6
tsc, eslint, build. Unit test dengan Sheets API di-mock: mapping baris, escape formula, idempotensi
retry, backoff, kegagalan Google tidak menggagalkan submit. Sediakan panduan uji end-to-end di
staging/form tes. Sebutkan yang tidak bisa diverifikasi (mis. API Google asli).
🛑 CHECKPOINT 6.6: laporkan hasil dan tampilkan isi migration untuk kureview.

---

## FASE 7: Saran Pengembangan Lanjutan (OPSIONAL, satu per satu)

Jangan mengimplementasikan semuanya. Tampilkan estimasi usaha dan manfaat, lalu tanya aku item
mana yang dikerjakan dan urutannya. Kerjakan satu item per branch, dengan checkpoint.

1. **Audit log** untuk aksi penting (hapus form/respons, ubah pengaturan). Jika sudah dibuat di
   Fase 5, perluas.
2. **CAPTCHA (Cloudflare Turnstile)** di submit form publik. Verifikasi token di server action.
   Jauh lebih efektif daripada rate limit in-memory.
3. **Notifikasi** submission baru (email atau WhatsApp ke PIC divisi).
4. **Soft delete** untuk form dan respons (kolom `deleted_at`, filter di query, RLS konsisten).
5. **Duplikasi form dan template** (berguna untuk OPREC tahun berikutnya).
6. **Status respons** (diterima / lolos / tidak lolos) di `form_responses`, yang juga bisa
   menggantikan Cek Hasil legacy (kaitkan dengan keputusan Fase 4B).
7. **Monitoring dan test**: Sentry (tanpa PII), test E2E Playwright untuk alur submit dan login.
8. **CI dan backup**: GitHub Actions (tsc, eslint, build), backup terjadwal, dokumentasi pemulihan.
9. **Unique index parsial** untuk duplikat NIM per form (hanya setelah dry-run membuktikan tidak
   ada duplikat di data produksi).

---

## FORMAT LAPORAN SETIAP FASE
- Ringkasan perubahan (file diubah/dihapus/dibuat dan alasannya)
- Hasil verifikasi (tsc, eslint, build, tes yang dijalankan)
- Hal yang TIDAK bisa diverifikasi
- Risiko / regresi yang mungkin dan rencana rollback
- Langkah manual yang harus kulakukan (urut, spesifik)
- Temuan baru (keamanan/data integrity dilaporkan jelas, jangan di-workaround diam-diam)
- Pertanyaan/keputusan yang menunggu aku

Mulai sekarang dengan CHECKPOINT 5.0 saja (ajukan pertanyaan keputusan awal). Jangan ubah kode
sebelum aku menjawab dan menyetujui.
