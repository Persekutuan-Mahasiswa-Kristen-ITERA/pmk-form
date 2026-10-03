-- ==========================================
-- MIGRASI 003: Perketat RLS admin dengan is_admin() + tutup anon INSERT
-- TAHAP 2 dari 2 (002 -> 003). Lihat urutan rollout di bawah.
-- ==========================================
-- MIGRASI 004 DIGABUNG KE SINI (revisi Checkpoint 3):
--   Alasan: submit form berjalan via server action (submitFormResponseAction)
--   yang memakai SERVICE ROLE (bypass RLS). Karena itu aplikasi TIDAK
--   bergantung pada anon INSERT ke form_responses. Menghapus anon INSERT
--   tidak akan memutus alur submit, jadi tidak perlu ditunda terpisah.
--   File 004 lama tetap di repo sebagai catatan sejarah, tetapi isinya sudah
--   tercakup di sini (bagian 2b).
--
-- TUJUAN:
--   - Mengganti policy "to authenticated using (true)" yang terlalu permisif
--     (user manapun yang login = admin penuh) dengan pengecekan is_admin().
--   - Mengganti SELECT forms "using (true)" dengan "is_open = true or
--     is_admin()" (lihat bagian 1a — alasan & dampak).
--   - Menutup jalur tulis anon ke form_responses (dulu: policy
--     "Anyone can submit form responses").
--
-- TIDAK mengubah:
--   - forms SELECT publik untuk form terbuka (sekarang via klausa OR, lihat 1a),
--   - storage INSERT anon (upload lampiran publik) & SELECT publik,
--   - data di tabel manapun (tidak ada DROP tabel/kolom/baris).
-- ==========================================

-- ---------- 1a. forms: SELECT ----------
-- Policy lama: "Admins can view all forms"  using (true)  (to authenticated)
-- -> SETIAP user yang LOGIN bisa membaca SEMUA form termasuk yang tertutup.
--
-- Policy BARU: using (is_open = true or public.is_admin())
--
-- ANALISIS DAMPAK (koreksi: anon TIDAK berubah):
--
--   * ANON (belum login) - TIDAK ADA PERUBAHAN:
--       Sebelum migration ini, anon hanya dilayani oleh policy
--       "Public can view open forms" (using is_open = true). Setelah
--       migration ini pun tetap sama. Jadi perilaku anon/frontpage publik
--       TIDAK berubah - bukan regresi.
--
--   * User LOGIN NON-ADMIN - INI YANG BERUBAH:
--       Sebelum: lolos via policy "Admins can view all forms" using (true)
--       -> bisa membaca form TERTUTUP juga.
--       Sesudah: hanya is_open = true (klausa pertama) atau is_admin()
--       (admin saja). Jadi user login biasa kini hanya lihat form terbuka,
--       sama seperti anon.
--
--   * ADMIN - TIDAK BERUBAH:
--       getFormById/getAllForms dipanggil setelah requireAdmin() di layer
--       data-access. Admin lolos via klausa is_admin(). Dashboard tetap bisa
--       melihat form tertutup.
--
-- DAMPAK NYATA pada halaman:
--
--   * Landing page `/` (getOpenForms): query sudah memfilter is_open = true.
--     TIDAK berubah untuk siapapun.
--
--   * Halaman form publik `/form/[slug]` (getFormBySlug, TIDAK filter is_open):
--       Saat form TERTUTUP:
--         - admin -> tetap bisa lihat (is_admin).
--         - user login biasa & anon -> getFormBySlug kembali null -> halaman
--           menampilkan "form tidak ditemukan".
--       INI PERUBAHAN hanya untuk user login biasa (sebelumnya mereka masih
--       bisa lihat form tertutup). Untuk anon SAMA SAJA seperti sebelumnya.
--       Mencegah bocornya struktur form (pertanyaan/field) yang sudah ditutup
--       -> ini peningkatan keamanan yang diinginkan.
--
--   * Admin dashboard: TIDAK berubah (admin lolos via is_admin).

drop policy if exists "Admins can view all forms" on public.forms;

create policy "Admins can view all forms"
  on public.forms for select
  to authenticated
  using (is_open = true or public.is_admin());

-- Policy "Public can view open forms" (anon, using is_open = true)
-- DIPERTAHANKAN tidak diubah: mengizinkan anon membaca form terbuka untuk
-- landing page & halaman form publik.

-- ---------- 1b. forms: write khusus admin ----------
drop policy if exists "Admins can insert forms" on public.forms;
drop policy if exists "Admins can update forms" on public.forms;
drop policy if exists "Admins can delete forms" on public.forms;

create policy "Admins can insert forms"
  on public.forms for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update forms"
  on public.forms for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete forms"
  on public.forms for delete
  to authenticated
  using (public.is_admin());

-- ---------- 2a. form_responses: read/delete khusus admin ----------
drop policy if exists "Admins can view form responses" on public.form_responses;
drop policy if exists "Admins can delete form responses" on public.form_responses;

create policy "Admins can view form responses"
  on public.form_responses for select
  to authenticated
  using (public.is_admin());

create policy "Admins can delete form responses"
  on public.form_responses for delete
  to authenticated
  using (public.is_admin());

-- ---------- 2b. form_responses: tutup anon INSERT (dulunya migration 004) ----------
-- Hapus policy "Anyone can submit form responses" (anon + authenticated INSERT
-- dengan with check (true)). Submit publik kini HANYA via server action
-- (submitFormResponseAction) yang memakai service role -> bypass RLS -> tetap
-- berfungsi. Lihat lib/supabase/service.ts & app/actions/submitResponse.ts.
drop policy if exists "Anyone can submit form responses" on public.form_responses;

-- Tidak dibuat policy INSERT pengganti: tanpa policy INSERT sama sekali,
-- RLS menolak INSERT dari client browser biasa, sementara service role
-- tetap bebas. Ini yang kita inginkan.

-- ---------- 3. selection_results / submissions / recruitments ----------
-- TIDAK ADA di migration ini. Ketiga tabel (termasuk policy lama yang namanya
-- tidak terdokumentasi) ditangani di MIGRASI 007
-- (007_legacy_tables_rls_and_user_roles_fix.sql), termasuk perbaikan infinite
-- recursion pada policy user_roles. Jalankan 003 dan 007 bersamaan.

-- ---------- 4. storage form-attachments: delete/update khusus admin ----------
drop policy if exists "Admins can delete files from form-attachments" on storage.objects;
drop policy if exists "Admins can update files from form-attachments" on storage.objects;

create policy "Admins can delete files from form-attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'form-attachments' and public.is_admin());

create policy "Admins can update files from form-attachments"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'form-attachments' and public.is_admin());

-- Policy upload (anon+auth INSERT, whitelist extension) & view (publik SELECT)
-- DIPERTAHANKAN: diperlukan untuk upload lampiran form publik.
-- Catatan: upload dari server action (uploadFormAttachment) memakai cookie
-- session user, jadi tetap berjalan melalui policy INSERT ini.

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only, jalankan di Supabase SQL Editor)
-- ==========================================
-- V1. Pastikan policy lama yang permisif sudah hilang. Hasilnya harus KOSONG:
--
--    select policyname, tablename, cmd
--    from pg_policies
--    where schemaname = 'public'
--      and (policyname in ('Anyone can submit form responses')
--           or (tablename = 'forms' and policyname = 'Admins can view all forms'
--               and qual::text like '%using (true)%'))
--      ;
--
-- V2. Daftar lengkap policy forms & form_responses (periksa is_admin muncul):
--
--    select tablename, policyname, cmd, roles, qual
--    from pg_policies
--    where schemaname = 'public' and tablename in ('forms','form_responses')
--    order by tablename, policyname;
--
--    Yang diharapkan:
--      forms            | Admins can delete forms          | DELETE
--      forms            | Admins can insert forms          | INSERT
--      forms            | Admins can update forms          | UPDATE
--      forms            | Admins can view all forms        | SELECT  (is_open OR is_admin())
--      forms            | Public can view open forms       | SELECT
--      form_responses   | Admins can delete form responses | DELETE
--      form_responses   | Admins can view form responses   | SELECT
--      (tidak ada policy INSERT untuk form_responses)
--
-- V3. Bukti fungsional (sebagai user login biasa, BUKAN service role):
--      select * from public.forms;                       -> hanya baris is_open
--      select * from public.form_responses limit 1;      -> harus KOSONG (0 baris)
--      insert into public.form_responses (form_id, answers)
--        values ('<uuid>', '{}');                        -> harus ERROR (RLS)
--
--    Sebagai admin terdaftar:
--      select * from public.forms;                       -> SEMUA baris
--      select * from public.form_responses limit 5;      -> ada baris
--
-- V4. Alur submit publik tetap berfungsi (via server action/service role).
--      PENTING: tidak ada form produksi yang is_open=true saat ini, jadi
--      WAJIB buat FORM TES terlebih dulu (lihat urutan rollout langkah 6).
--      Buka form tes terbuka di browser -> isi -> Kirim -> harus sukses.
--      (Tidak bisa diuji dari SQL Editor; lihat docs/E2E_TEST_GUIDE.md.)
--
-- ==========================================
-- URUTAN ROLLOUT (WAJIB diikuti berurutan)
-- ==========================================
-- 1. (Anda) Backup database (dashboard Supabase / pg_dump). WAJIB: migration
--    007 tidak bisa di-rollback tanpa backup (policy lama tak terdokumentasi).
-- 2. (Anda) Matikan signup publik di Supabase Dashboard.
-- 3. (Anda) Jalankan MIGRASI 002 DAN 002b BERSAMAAN (sebelum deploy).
--    - 002 membuat fungsi is_admin() + seed admin.
--    - 002b memperbaiki infinite recursion policy user_roles. JIKA 002b
--      TIDAK dijalankan sebelum deploy, getAdminUser() error 42P17 untuk
--      SEMUA user -> login admin mendapat 403 -> rollout gagal di langkah 5.
--    Pastikan RAISE NOTICE "SEED ADMIN OK" (002) muncul. Jika 002 gagal
--    (email admin tidak ketemu), BERHENTI - jangan lanjut.
-- 4. (Deploy) Deploy kode aplikasi (requireAdmin() + submit via service role).
--    JANGAN deploy sebelum langkah 3 selesai.
-- 5. (Anda) Verifikasi: login admin -> /admin/dashboard OK; user biasa -> 403.
--    Ini juga bukti 002b bekerja (tidak ada error 42P17).
--
-- 6. (Anda) BUAT FORM TES SEMENTARA untuk uji submit (lihat langkah 7):
--    - Login admin -> /admin/forms/new -> judul "FORM UJI E2E (hapus nanti)",
--      slug "form-uji-e2e", jenis "general".
--    - Tanggal buka: sekarang; tanggal tutup: +1 jam (PASTIKAN TERBUKA).
--    - Tambah 1 field teks wajib (mis. "Nama Lengkap").
--    - Simpan. Pastikan form muncul di landing page /. INI SYARAT: semua form
--      produksi saat ini is_open=false, sehingga TANPA form tes ini, tidak
--      ada form terbuka untuk diuji submit-nya.
--
-- 7. (Anda) Jalankan MIGRASI INI (003) dan MIGRASI 007 (legacy tables)
--    dalam satu sesi. Lalu uji alur submit dengan form tes langkah 6:
--    - Buka /form/form-uji-e2e di tab incognito (anon).
--    - Isi field -> Kirim -> harus redirect ke halaman sukses.
--    - Cek di /admin/forms/<id>/responses bahwa respons masuk.
--    Uji ini WAJIB sebelum langkah 8: jika submit gagal, jangan lanjutkan.
--
-- 8. (Anda) Jalankan verifikasi V1-V4 di atas (dengan form tes langkah 6).
-- 9. (Anda) TUTUP form tes: edit form -> set is_open=false (atau hapus
--    beserta responsnya) setelah uji selesai. Cleanup lihat
--    docs/E2E_TEST_GUIDE.md bagian "Bersih-bersih".
-- 10. (Anda) Jalankan MIGRASI 005 (limit bucket storage) - kapan saja, aman.
-- 11. (Anda) Setelah semua terverifikasi, aktifkan kembali signup publik HANYA
--     jika memang diperlukan (sebelumnya aktif; pertimbangkan tetap dimatikan
--     karena semua admin sudah di-seed).
--
-- MIGRASI 006 (unique index NIM) adalah USULAN untuk Fase 2/3, JANGAN dijalankan.
--
-- ROLLBACK ( jika langkah 4/5 gagal ):
--  - Kode aplikasi: redeploy versi SEBELUM branch ini.
--  - Database: pulihkan policy permisif lama (jalankan blok di bawah), LALU
--    drop function is_admin() jika ingin benar-benar kembali (lihat catatan).
--
--    drop policy if exists "Admins can view all forms" on public.forms;
--    create policy "Admins can view all forms" on public.forms
--      for select to authenticated using (true);
--
--    drop policy if exists "Admins can insert forms" on public.forms;
--    drop policy if exists "Admins can update forms" on public.forms;
--    drop policy if exists "Admins can delete forms" on public.forms;
--    create policy "Admins can insert forms" on public.forms
--      for insert to authenticated with check (true);
--    create policy "Admins can update forms" on public.forms
--      for update to authenticated using (true) with check (true);
--    create policy "Admins can delete forms" on public.forms
--      for delete to authenticated using (true);
--
--    drop policy if exists "Admins can view form responses" on public.form_responses;
--    drop policy if exists "Admins can delete form responses" on public.form_responses;
--    create policy "Admins can view form responses" on public.form_responses
--      for select to authenticated using (true);
--    create policy "Admins can delete form responses" on public.form_responses
--      for delete to authenticated using (true);
--
--    drop policy if exists "Admins can delete files from form-attachments" on storage.objects;
--    drop policy if exists "Admins can update files from form-attachments" on storage.objects;
--    create policy "Admins can delete files from form-attachments" on storage.objects
--      for delete to authenticated using (bucket_id = 'form-attachments');
--    create policy "Admins can update files from form-attachments" on storage.objects
--      for update to authenticated using (bucket_id = 'form-attachments');
--
--    -- Kembalikan anon INSERT (dulunya policy "Anyone can submit form responses"):
--    create policy "Anyone can submit form responses" on public.form_responses
--      for insert to anon, authenticated with check (true);
--
--  - URUTAN ROLLBACK PENTING: ROLLBACK MIGRASI 003 (blok di atas) HARUS
--    DILAKUKAN SEBELUM drop function is_admin(). Sebab policy di 007 dan
--    bagian 1a/1b/2a/2b/4 di migration ini semua memanggil public.is_admin().
--    Jika fungsi di-drop lebih dulu, SETIAP query ke forms/form_responses/
--    storage akan error "function public.is_admin() does not exist".
--  - Migration 002 hanya menambah fungsi + baris seed; drop fungsi dan hapus
--    baris user_roles milik admin jika ingin kembali sepenuhnya (lihat
--    rollback di file 002).
-- ==========================================
