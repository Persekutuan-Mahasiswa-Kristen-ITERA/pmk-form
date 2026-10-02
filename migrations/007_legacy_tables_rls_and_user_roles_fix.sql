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
--   mencatatnya (untuk audit atau rollback manual bila diperlukan).
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
--   !!! JUJUR: policy lama untuk ketiga tabel ini TIDAK BISA DIPULIHKAN
--   !!! otomatis oleh migration ini. Sebabnya: nama policy lama tidak
--   !!! terdokumentasi di repo (dibuat di schema pra-001), dan definisinya
--   !!! (klausa using/with_check asli) tidak disimpan saat migration ini
--   !!! dijalankan. RAISE NOTICE di atas hanya MENCETAK nama; jika Anda
--   !!! tidak mencatatnya, informasi itu hilang.
--   !!!
--   !!! Cara rollback yang andal: pulihkan dari BACKUP database yang dibuat
--   !!! sebelum rollout (lihat langkah 1 urutan rollout). Itu satu-satunya
--   !!! jaminan untuk mendapatkan kembali definisi policy asli.
--   !!!
--   !!! Jika Anda MENCATAT nama policy dari RAISE NOTICE dan tahu definisinya,
--   !!! bisa pulihkan manual:
--
--   begin;
--   drop policy if exists "Admins can manage selection results" on public.selection_results;
--   drop policy if exists "Admins can manage submissions" on public.submissions;
--   drop policy if exists "Admins can manage recruitments" on public.recruitments;
--   -- Buat ulang policy lama SESUAI catatan Anda, contoh bentuk umum:
--   -- create policy "<nama lama>" on public.selection_results
--   --   for all to authenticated using (true) with check (true);
--   commit;
--
--   Catatan: rollback ini mengembalikan kondisi permisif (user login biasa
--   bisa baca semua data pendaftar) - hanya lakukan jika ada masalah darurat.
-- ==========================================
