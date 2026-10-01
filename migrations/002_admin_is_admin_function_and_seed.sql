-- =========================================
-- MIGRASI 002: Fungsi is_admin() + Seed user_roles
-- TAHAP 1 dari 3 (lihat urutan rollout di bawah / laporan Checkpoint 2)
-- =========================================
-- AMAN: hanya MENAMBAH objek baru. Tidak menghapus/mengubah policy, tabel,
-- atau data yang sudah ada. Tidak menonaktifkan RLS.
-- =========================================

-- 1. Fungsi is_admin()
--    Default-deny: TRUE hanya jika user saat ini punya baris di user_roles.
--    SECURITY DEFINER agar evaluasinya LEWAT RLS (mem bypass policy user_roles)
--    -> mencegah rekursi policy saat dipakai di RLS tabel lain.
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
-- GANTI 'GANTI@EMAIL' dengan email admin yang sebenarnya. Subselect mengambil
-- UUID dari auth.users berdasarkan email, jadi Anda tidak perlu mencari UUID
-- manual. Untuk menambah admin lain, duplikat blok INSERT dengan email lain.
--
-- (Sesuai keputusan Fase 1: ada baris di user_roles = admin. Pembatasan per
--  divisi ditunda ke Fase 4.)

insert into public.user_roles (user_id, role, division)
select id, 'super_admin', null
from auth.users
where email = 'GANTI@EMAIL'
on conflict (user_id) do nothing;

-- VERIFIKASI seed berhasil (read-only):
--   select ur.user_id, u.email, ur.role from public.user_roles ur
--   join auth.users u on u.id = ur.user_id;
--
-- Jika hasilnya 0 baris -> email salah/ketemu; ganti 'GANTI@EMAIL' dan
-- jalankan ulang blok INSERT di atas.

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
--  - Database: file 002 hanya menambah fungsi & (opsional) baris seed;
--    drop fungsi bila perlu:
--        drop function if exists public.is_admin();
--    serta hapus baris seed yang baru dibuat. Tidak ada policy yang diubah,
--    sehingga RLS kembali ke perilaku semula tanpa langkah tambahan.
--  - Jika Anda terkunci dari admin padahal akun Anda seharusnya admin,
--    RECOVERY termudah: jalankan ulang bagian SEED di file ini dengan UUID
--    akun Anda (tidak perlu redeploy aplikasi).
--  - Pastikan signup publik tetap NONAKTIF setelah rollback.
-- ==========================================
