-- ==========================================
-- MIGRASI 007: Perketat RLS tabel legacy (selection_results, submissions, recruitments)
-- TAHAP 2b — dijalankan SETELAH deploy + verifikasi (bersama 003).
-- ==========================================
-- LIHAT JUGA: perbaikan policy user_roles TIDAK di file ini, sudah dipindah ke
-- MIGRASI 002b (dijalankan bersama 002, sebelum deploy). File ini hanya
-- menangani tabel-tabel legacy berikut.
--
-- LATAR BELAKANG (hasil audit):
--
--   Tabel `selection_results`, `submissions`, `recruitments` TIDAK tercakup
--   migration sebelumnya. Audit anon key membuktikan SELECT anon sudah
--   diblokir di semua tabel (RLS aktif efektif untuk baca). Tetapi policy
--   lama untuk user LOGIN terlalu permisif (menggunakan using (true)), sehingga
--   user login biasa bisa membaca data pendaftar lain.
--
--   - `selection_results`: /api/cek-hasil memakai SERVICE ROLE (bypass RLS)
--     -> fitur cek hasil TETAP berfungsi setelah pengetatan ini. Tidak ada
--     alasan user login biasa bisa baca SEMUA hasil seleksi.
--   - `submissions`: tabel LEGACY (sudah dimigrasi ke form_responses, 239
--     baris). Tidak ada kode aplikasi yang membacanya lagi.
--   - `recruitments`: tabel LEGACY (sudah dimigrasi ke forms). Tidak ada
--     kode aplikasi yang membacanya lagi.
--
--   PERHATIAN: pengetatan ini AMAN hanya karena aplikasi membaca ketiga
--   tabel ini melalui service role atau tidak sama sekali. Jika nanti ada
--   halaman publik yang harus membaca `recruitments`/`submissions`, tambahkan
--   policy SELECT khusus.
--
-- CARA KERJA (penting):
--   Nama policy lama ketiga tabel ini TIDAK terdokumentasi di repo (dibuat di
--   schema pra-001). `drop policy if exists` dengan nama tebakan adalah NO-OP
--   jika tebakan salah -> policy lama TETAP HIDUP dan tetap permisif. Karena
--   itu kita baca nama policy dari pg_policies dan drop secara dinamis.
--   Nama setiap policy yang dihapus DICETAK via RAISE NOTICE agar Anda bisa
--   memverifikasi policy mana yang terhapus. Definisi LENGKAP policy lama
--   sudah di-snapshot saat GATE 0 ke docs/LEGACY_POLICY_SNAPSHOT.md, sehingga
--   bagian ROLLBACK di bawah bisa memulihkannya persis seperti semula.
--
-- AMAN: tidak DROP tabel/kolom/data. Hanya DROP POLICY lalu CREATE POLICY
-- baru. Data di tabel lama TIDAK DISENTUH.
-- ==========================================

-- Seluruh migration ini satu kesatuan atomik: jika salah satu tabel gagal,
-- semua perubahan dibatalkan (tidak ada kondisi setengah jalan).
begin;

-- ---------- 1. selection_results: admin only ----------
do $$
declare
  r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'selection_results'
           order by policyname
  loop
    raise notice 'selection_results: menghapus policy lama "%" (diganti admin-only)', r.policyname;
    execute format('drop policy if exists %I on public.selection_results', r.policyname);
  end loop;
end
$$;

create policy "Admins can manage selection results"
  on public.selection_results for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 2. submissions (legacy): admin only ----------
do $$
declare
  r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'submissions'
           order by policyname
  loop
    raise notice 'submissions: menghapus policy lama "%" (diganti admin-only)', r.policyname;
    execute format('drop policy if exists %I on public.submissions', r.policyname);
  end loop;
end
$$;

create policy "Admins can manage submissions"
  on public.submissions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 3. recruitments (legacy): admin only ----------
do $$
declare
  r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'recruitments'
           order by policyname
  loop
    raise notice 'recruitments: menghapus policy lama "%" (diganti admin-only)', r.policyname;
    execute format('drop policy if exists %I on public.recruitments', r.policyname);
  end loop;
end
$$;

create policy "Admins can manage recruitments"
  on public.recruitments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only, jalankan di SQL Editor)
-- ==========================================
-- V1. Policy baru harus muncul, policy lama harus hilang:
--
--    select tablename, policyname, cmd, roles, qual
--    from pg_policies
--    where schemaname = 'public'
--      and tablename in ('selection_results','submissions','recruitments')
--    order by tablename, policyname;
--
--    Yang diharapkan (persis 3 baris):
--      recruitments      | Admins can manage recruitments      | ALL | {authenticated}
--      selection_results | Admins can manage selection results | ALL | {authenticated}
--      submissions       | Admins can manage submissions       | ALL | {authenticated}
--
--    Semua qual harus (is_admin()) dan with_check (is_admin()).
--
-- V2. Bukti fungsional sebagai user login biasa (BUKAN service role):
--      select * from public.selection_results limit 1;  -> harus KOSONG
--      select * from public.submissions limit 1;        -> harus KOSONG
--      select * from public.recruitments limit 1;       -> harus KOSONG
--
--    Sebagai admin terdaftar:
--      select count(*) from public.selection_results;   -> ada baris
--
-- V3. /api/cek-hasil tetap berfungsi (baca via service role, bypass RLS):
--      curl -X POST <URL>/api/cek-hasil -d '{"nim":"...","email":"..."}'
--      -> harus tetap kembali status seleksi
--
-- ROLLBACK:
-- !!! BERITA BAIK: rollback 007 SEKARANG LENGKAP dan jujur.
-- !!! Sebelum rollout, definisi policy lama ketiga tabel ini TIDAK terdokumentasi
-- !!! di repo. Tapi Anda sudah mengambil SNAPSHOTNYA saat GATE 0 (query
-- !!! pg_policies) dan menyimpannya di docs/LEGACY_POLICY_SNAPSHOT.md.
-- !!! Karena itu rollback di bawah ini memakai definisi ASLI persis seperti
-- !!! sebelum 007 - TIDAK butuh backup DB seluruhnya.
-- !!!
-- !!! (Jika Anda belum mengambil snapshot, jalanankan query di
-- !!!  docs/LEGACY_POLICY_SNAPSHOT.md SEBELUM migration 007, karena blok
-- !!!  rollback ini butuh data itu untuk benar-benar akurat.)

begin;

-- 1. Hapus policy admin-only hasil 007
drop policy if exists "Admins can manage selection results" on public.selection_results;
drop policy if exists "Admins can manage submissions" on public.submissions;
drop policy if exists "Admins can manage recruitments" on public.recruitments;

-- 2. Pulihkan policy lama PERSIS seperti snapshot (docs/LEGACY_POLICY_SNAPSHOT.md)

-- selection_results
create policy "Admins can manage selection results"
  on public.selection_results for all
  to authenticated
  using (true)
  with check (true);

-- submissions
drop policy if exists "Admins can view submissions" on public.submissions;
drop policy if exists "Admins can update submissions" on public.submissions;
drop policy if exists "Admins can delete submissions" on public.submissions;
drop policy if exists "Public can submit applications" on public.submissions;

create policy "Admins can view submissions"
  on public.submissions for select
  to authenticated
  using (true);

create policy "Admins can update submissions"
  on public.submissions for update
  to authenticated
  using (true)
  with check (true);

create policy "Admins can delete submissions"
  on public.submissions for delete
  to authenticated
  using (true);

create policy "Public can submit applications"
  on public.submissions for insert
  to anon, authenticated
  with check (true);

-- recruitments
drop policy if exists "Admins can view all recruitments" on public.recruitments;
drop policy if exists "Admins can insert recruitments" on public.recruitments;
drop policy if exists "Admins can update recruitments" on public.recruitments;
drop policy if exists "Admins can delete recruitments" on public.recruitments;
drop policy if exists "Public can view open recruitments" on public.recruitments;

create policy "Admins can view all recruitments"
  on public.recruitments for select
  to authenticated
  using (true);

create policy "Admins can insert recruitments"
  on public.recruitments for insert
  to authenticated
  with check (true);

create policy "Admins can update recruitments"
  on public.recruitments for update
  to authenticated
  using (true)
  with check (true);

create policy "Admins can delete recruitments"
  on public.recruitments for delete
  to authenticated
  using (true);

create policy "Public can view open recruitments"
  on public.recruitments for select
  to public
  using (is_open = true);

commit;

-- Catatan: rollback ini mengembalikan kondisi permisif lama (user login biasa
-- bisa baca semua data pendaftar). Hanya lakukan jika ada masalah darurat.
-- Setelah rollback, jalankan ulang migration 007 setelah masalah diperbaiki.
-- ==========================================
