-- ==========================================
-- MIGRASI 002: Fungsi is_admin() + Seed user_roles
-- TAHAP 1 dari 3 (lihat urutan rollout di bawah / laporan Checkpoint 2)
-- ==========================================
-- AMAN: hanya MENAMBAH objek baru. Tidak menghapus/mengubah policy, tabel,
-- atau data yang sudah ada. Tidak menonaktifkan RLS.
-- ==========================================

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

-- Beri akses eksekusi ke publik (anon + authenticated); fungsi sendiri sudah
-- default-deny sehingga aman dipanggil siapa saja.
grant execute on function public.is_admin() to anon, authenticated;

-- ==========================================
-- 2. SEED admin pertama
-- ==========================================
-- GANTI placeholder di bawah dengan UUID user admin yang sebenarnya dari
-- auth.users. Cara mencarinya di Supabase SQL Editor (database roles):
--
--     select id, email, created_at from auth.users order by created_at;
--
-- Setelah itu, masukkan satu baris per admin. Role 'super_admin' = akses penuh.
-- (Sesuai keputusan Fase 1: ada baris di user_roles = admin. Pembatasan per
--  divisi ditunda ke Fase 4.)
--
-- CONTOH (hapus komentar dan ganti <ADMIN_USER_UUID>):
--
-- insert into public.user_roles (user_id, role, division)
-- values ('<ADMIN_USER_UUID>', 'super_admin', null)
-- on conflict (user_id) do nothing;

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
