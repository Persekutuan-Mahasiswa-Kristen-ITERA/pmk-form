-- ==========================================
-- MIGRASI 007: Audit RLS tabel lama + perbaiki user_roles recursion
-- ==========================================
-- LATAR BELAKANG (hasil audit):
--
--  1. Policy lama `user_roles` "Super admin can manage all roles" memakai
--     subquery ke `public.user_roles` SENDIRI:
--
--         using (exists (select 1 from public.user_roles ur
--                       where ur.user_id = auth.uid() and ur.role='super_admin'))
--
--     Saat RLS aktif, PostgreSQL mengevaluasi policy dengan menjalankan query
--     yang MEMBACA user_roles -> yang juga kena RLS -> memanggil policy lagi ->
--     **INFINITE RECURSION**. PostgreSQL memang mendeteksinya (error
--     "infinite recursion detected in policy"), tetapi akibatnya SEMUA operasi
--     tulis user_roles oleh super_admin (termasuk menambah admin baru) GAGAL.
--     Ini membuat manajemen admin tidak bisa dipakai sama sekali.
--
--     SOLUSI: ganti subquery dengan `public.is_admin()` yang SECURITY DEFINER
--     (evaluasinya LEWAT RLS, tidak rekursif). Ditambah agar super_admin tetap
--     bisa kelola: policy pakai is_admin() saja (semua admin bisa lihat/kelola
--     role untuk saat ini; pembatasan super_admin-only bisa ditambah di Fase 4).
--
--  2. Tabel lama `selection_results`, `submissions`, `recruitments` TIDAK
--     tercakup migration sebelumnya. Audit via anon key membuktikan SELECT
--     anon sudah diblokir di semua tabel (RLS aktif efektif untuk baca).
--     Karena aplikasi sudah memakai service role untuk semua akses admin dan
--     untuk /api/cek-hasil, dan TIDAK ada kode aplikasi yang menulis ketiga
--     tabel ini lagi (data sudah dimigrasi penuh ke forms/form_responses),
--     maka RLS diperketat: baca publik hanya untuk yang memang dibutuhkan.
--
--     - `selection_results`: /api/cek-hasil pakai SERVICE ROLE (bypass RLS)
--       -> tetap berfungsi. Tidak ada alasan user login biasa bisa baca
--       SEMUA hasil seleksi (bocor data pendaftar lain). -> admin only.
--     - `submissions`: tabel LEGACY (sudah dimigrasi ke form_responses, 239
--       baris). Tidak ada kode aplikasi yang membacanya lagi. -> admin only.
--     - `recruitments`: tabel LEGACY (sudah dimigrasi ke forms). Tidak ada
--       kode aplikasi yang membacanya lagi. -> admin only.
--
--     PERHATIAN: pengetatan ini AMAN hanya karena aplikasi membaca ketiga
--     tabel ini melalui service role (lib/supabase/service.ts) atau tidak
--     sama sekali. Jika nanti ada halaman publik yang harus membaca
--     `recruitments`/`submissions`, tambahkan policy SELECT khusus.
--
-- AMAN: tidak DROP tabel/kolom/data. Hanya DROP POLICY lalu CREATE POLICY
-- baru. Data di tabel lama TIDAK DISENTUH.
-- ==========================================

-- ---------- 1. user_roles: hilangkan recursion ----------

drop policy if exists "Super admin can manage all roles" on public.user_roles;

-- Policy pengganti: admin (is_admin()) bisa lihat & kelola semua role.
-- is_admin() SECURITY DEFINER -> evaluasinya lewat RLS -> TIDAK rekursif.
create policy "Admins can manage all roles"
  on public.user_roles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Policy "User can view own role" (SELECT baris sendiri) DIPERTAHANKAN:
-- user non-admin tetap bisa membaca baris role-nya sendiri (diperlukan oleh
-- getCurrentUserRole()). Tidak ada recursion karena hanya membandingkan
-- user_id = auth.uid(), tidak subquery ke tabel lain.
-- (Tidak di-drop, tidak diubah.)

-- ---------- 2. selection_results: admin only ----------
-- Policy lama di tabel ini dibuat di schema PRA-001 dan namanya TIDAK
-- terdokumentasi di repo. `drop policy if exists` dengan nama tebakan adalah
-- NO-OP jika tebakan salah -> policy lama TETAP HIDUP dan tetap permisif.
-- Karena itu kita hapus SEMUA policy pada tabel ini secara dinamis dari
-- pg_policies, lalu buat satu policy admin-only. Aman: setelah ini tabel
-- hanya bisa diakses admin (atau service role yang bypass RLS).

do $$
declare
  r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'selection_results'
  loop
    execute format('drop policy if exists %I on public.selection_results', r.policyname);
  end loop;
end
$$;

create policy "Admins can manage selection results"
  on public.selection_results for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 3. submissions (legacy): admin only ----------
-- Sama: nama policy lama tidak diketahui -> drop dinamis.

do $$
declare
  r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'submissions'
  loop
    execute format('drop policy if exists %I on public.submissions', r.policyname);
  end loop;
end
$$;

create policy "Admins can manage submissions"
  on public.submissions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 4. recruitments (legacy): admin only ----------
-- Sama: nama policy lama tidak diketahui -> drop dinamis.

do $$
declare
  r record;
begin
  for r in select policyname
           from pg_policies
           where schemaname = 'public' and tablename = 'recruitments'
  loop
    execute format('drop policy if exists %I on public.recruitments', r.policyname);
  end loop;
end
$$;

create policy "Admins can manage recruitments"
  on public.recruitments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only, jalankan di SQL Editor)
-- ==========================================
-- 1. Daftar policy per tabel (harus muncul policy baru, policy lama hilang):
--
--    select tablename, policyname, cmd, qual
--    from pg_policies
--    where schemaname = 'public'
--    order by tablename, policyname;
--
--    Yang diharapkan:
--      form_responses   | Admins can delete form responses   | DELETE
--      form_responses   | Admins can view form responses     | SELECT
--      forms            | Admins can delete forms            | DELETE
--      forms            | Admins can insert forms            | INSERT
--      forms            | Admins can update forms            | UPDATE
--      forms            | Admins can view all forms          | SELECT
--      forms            | Public can view open forms         | SELECT
--      recruitments     | Admins can manage recruitments     | ALL
--      selection_results| Admins can manage selection results| ALL
--      submissions      | Admins can manage submissions      | ALL
--      user_roles       | Admins can manage all roles        | ALL
--      user_roles       | User can view own role             | SELECT
--
-- 2. Bukti TIDAK ada recursion lagi - jalankan sebagai user admin terdaftar
--    (bukan service role):
--
--    select * from public.user_roles;          -- harus kembali baris (termasuk milik user lain)
--    insert into public.user_roles (user_id, role)
--    values ('<UUID_USER_TEST>', 'divisi_admin');  -- harus SUKSES, bukan error recursion
--    delete from public.user_roles where user_id = '<UUID_USER_TEST>';
--
--    SEBELUM migration 007, kedua statement di atas akan error:
--    "infinite recursion detected in policy for relation user_roles"
--
-- 3. /api/cek-hasil tetap berfungsi (baca via service role, bypass RLS):
--
--    curl -X POST <URL>/api/cek-hasil -d '{"nim":"...","email":"..."}'
--    -> harus tetap kembali status seleksi
--
-- ROLLBACK:
--   drop policy if exists "Admins can manage all roles" on public.user_roles;
--   create policy "Super admin can manage all roles" on public.user_roles
--     for all to authenticated
--     using (exists (select 1 from public.user_roles ur
--                    where ur.user_id = auth.uid() and ur.role = 'super_admin'))
--     with check (exists (select 1 from public.user_roles ur
--                    where ur.user_id = auth.uid() and ur.role = 'super_admin'));
--
--   drop policy if exists "Admins can manage selection results" on public.selection_results;
--   drop policy if exists "Admins can manage submissions" on public.submissions;
--   drop policy if exists "Admins can manage recruitments" on public.recruitments;
--   -- Policy lama untuk ketiga tabel ini TIDAK diketahui namanya (dibuat di
--   -- schema pra-001, tidak terdokumentasi di repo). Rollback hanya menghapus
--   -- policy baru -> ketiga tabel menjadi TIDAK memiliki policy -> RLS menolak
--   -- semua akses (lebih aman daripada permisif). Pulihkan akses admin dengan
--   -- menjalankan ulang migration 007 jika perlu.
-- ==========================================
