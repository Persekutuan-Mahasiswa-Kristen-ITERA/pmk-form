-- =========================================
-- MIGRASI 002: Fungsi is_admin() + Seed user_roles
-- TAHAP 1 dari 3 (lihat urutan rollout di bawah / laporan Checkpoint 2)
-- =========================================
-- AMAN: hanya MENAMBAH objek baru. Tidak menghapus/mengubah policy, tabel,
-- atau data yang sudah ada. Tidak menonaktifkan RLS.
-- =========================================

-- 1. Fungsi is_admin()
--    Default-deny: TRUE hanya jika user saat ini punya baris di user_roles.
--    SECURITY DEFINER: fungsi dieksekusi dengan hak akses OWNER-nya
--    (role superuser postgres), sehingga query di dalamnya MEM-BYPASS RLS
--    - bukan "dievaluasi lewat RLS". Ini penting: kalau tidak bypass,
--    pemanggilan is_admin() dari policy user_roles akan membaca user_roles
--    yang kena RLS -> rekursi (lihat migration 002b). Dengan bypass, evaluasi
--    is_admin() tidak memicu policy tabel sama sekali.
--    search_path dikunci ke schema public untuk mencegah hijack search_path.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
    );
$$;

comment on function public.is_admin() is
  'TRUE bila user saat ini memiliki baris di public.user_roles (cek admin default-deny). '
  'SECURITY DEFINER + set search_path agar bisa dipakai di RLS tanpa rekursi policy.';

-- Eksekusi fungsi: cabut dari semua role, lalu berikan HANYA ke authenticated.
-- Anon TIDAK boleh bisa memanggil is_admin() (auth.uid() mereka null, jadi
-- hasilnya false, tapi kita tetap membatasi untuk prinsip least-privilege dan
-- untuk mencegah info-leakage probe). Untuk percobaan anon, lihat catatan
-- di bawah.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ==========================================
-- 2. SEED admin pertama
-- ==========================================
-- Email admin diisi di bawah. Subselect mengambil UUID dari auth.users
-- berdasarkan email, jadi Anda tidak perlu mencari UUID manual.
-- Untuk menambah admin lain, duplikat blok DO di bawah dengan email lain.
--
-- (Sesuai keputusan Fase 1: ada baris di user_roles = admin. Pembatasan per
--  divisi ditunda ke Fase 4.)

-- !!! PENTING: DO-block di bawah GAGAL (EXCEPTION) jika email tidak ditemukan
-- di auth.users. Ini disengaja: lebih baik migration gagal keras di sini
-- daripada Anda deploy kode requireAdmin() dan terkunci dari dashboard admin
-- karena belum ada baris di user_roles.
do $$
declare
  admin_count int;
begin
  insert into public.user_roles (user_id, role, division)
  select id, 'super_admin', null
  from auth.users
  where email = 'biroitpmkitera@gmail.com'
  on conflict (user_id) do nothing;

  -- Verifikasi baris admin untuk email ini benar-benar ada. Cek ini juga
  -- mencakup baris dari percobaan sebelumnya, karena on conflict do nothing
  -- membuat migration ini idempoten.
  select count(*) into admin_count
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  where u.email = 'biroitpmkitera@gmail.com';

  if admin_count = 0 then
    raise exception
      'SEED ADMIN GAGAL: tidak ada user di auth.users dengan email = ''biroitpmkitera@gmail.com''. '
      'Periksa bahwa email tersebut sudah terdaftar (tabel auth.users) dan ejaannya '
      'benar, lalu jalankan ulang migration 002. JANGAN deploy kode requireAdmin() '
      'sebelum seed ini berhasil - Anda akan terkunci dari dashboard admin.';
  end if;

  raise notice 'SEED ADMIN OK: % baris user_roles untuk biroitpmkitera@gmail.com.', admin_count;
end
$$;

-- VERIFIKASI tambahan (read-only, jalankan setelah migration):
--   select ur.user_id, u.email, ur.role from public.user_roles ur
--   join auth.users u on u.id = ur.user_id;
-- Hasil yang diharapkan: minimal 1 baris dengan email
--   biroitpmkitera@gmail.com dan role = super_admin.

-- ==========================================
-- URUTAN ROLLOUT (WAJIB diikuti berurutan)
-- ==========================================
-- 1. (Anda) Backup database (dashboard Supabase / pg_dump).
-- 2. (Anda) Matikan signup publik di Supabase Dashboard:
--       Authentication -> Sign In / Providers -> Email -> disable "Allow new
--       users to sign up".
-- 3. (Anda) Jalankan file INI (002) -> membuat fungsi is_admin() + seed admin.
--    PASTIKAN langkah 3 selesai & baris user_roles untuk diri Anda sudah ada.
-- 4. (Deploy) Deploy kode aplikasi (requireAdmin() aktif).
--    JANGAN deploy sebelum langkah 3 selesai, atau Anda terkunci dari admin.
-- 5. (Anda) Verifikasi: login admin & buka /admin/dashboard (harus tampil
--    normal); signup user baru & login -> harus terlihat halaman "Akses Ditolak".
-- 6. (Anda) Jalankan migration 003 (perketat RLS) hanya setelah langkah 5 OK.
-- 7. (Anda) Setelah alur submit via server action terverifikasi di produksi,
--    jalankan migration 004 (hapus anon INSERT ke form_responses).
--
-- ROLLBACK ( jika langkah 4/5 gagal ):
--  - Kode aplikasi: redeploy versi SEBELUM branch ini (requireAdmin() hilang).
--  - Database: file 002 hanya menambah fungsi & baris seed. Untuk kembali:
--
--      -- 1. Hapus baris seed admin (berdasarkan EMAIL, bukan UUID):
--      delete from public.user_roles
--      where user_id = (
--        select id from auth.users where email = 'biroitpmkitera@gmail.com'
--      );
--
--      -- 2. Drop fungsi is_admin().
--      --    !!! HANYA setelah rollback migration 003 dijalankan, karena
--      --    semua policy di 003 memanggil public.is_admin(). Lihat urutan
--      --    di bawah.
--      drop function if exists public.is_admin();
--
--  - URUTAN ROLLBACK PENTING (jangan dibalik):
--      1. Rollback MIGRASI 003 dulu (pulihkan policy permisif lama),
--      2.baru drop function public.is_admin(),
--      3. barulah hapus baris seed (boleh sebelum atau sesudah drop fungsi).
--
--    Sebab: policy di migration 003 memanggil public.is_admin(). Jika fungsi
--    di-drop lebih dulu, setiap query ke forms / form_responses / storage
--    akan error "function public.is_admin() does not exist" dan dashboard
--    admin jadi tidak bisa dipakai.
--
--  - Tidak ada policy di 002 yang diubah, sehingga RLS kembali ke perilaku
--    semula tanpa langkah tambahan.
--  - Jika Anda terkunci dari admin padahal akun Anda seharusnya admin,
--    RECOVERY termudah: jalankan ulang blok DO di atas (cukup deploy ulang
--    file 002 - TIDAK perlu redeploy aplikasi). Cek RAISE NOTICE/EXCEPTION
--    untuk memastikan email sudah terdaftar.
--  - Pastikan signup publik tetap NONAKTIF setelah rollback.
-- ==========================================
