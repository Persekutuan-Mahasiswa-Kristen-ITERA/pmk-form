-- ==========================================
-- MIGRASI 004: Hapus anon INSERT ke form_responses
-- TAHAP 3 dari 3 — JALANKAN HANYA SETELAH migration 003 diterapkan DAN
-- alur submit via server action (submitFormResponseAction) TERVERIFIKASI
-- berfungsi di produksi.
-- ==========================================
-- TUJUAN: menutup jalur tulis langsung ke form_responses dari client anon,
-- sehingga satu-satunya cara submit adalah melalui server action yang sudah
-- memvalidasi (form terbuka, close_date, max_responses, duplikat NIM, skema
-- Zod dari field config). Server action memakai SERVICE ROLE yang bypass RLS,
-- sehingga submit publik tetap berfungsi setelah migration ini.
--
-- TIDAK DROP tabel/kolom, TIDAK menonaktifkan RLS.
-- ==========================================

-- Hapus policy "Anyone can submit form responses" (anon + authenticated INSERT).
drop policy if exists "Anyone can submit form responses" on public.form_responses;

-- Ganti: hanya admin (lewat aplikasi/service role) yang bisa insert langsung.
-- Karena server action memakai service role (bypass RLS), policy ini hanya
-- mencegah insert dari client browser biasa.
create policy "Admins can insert form responses"
  on public.form_responses for insert
  to authenticated
  with check (public.is_admin());

-- ==========================================
-- ROLLBACK
-- ==========================================
-- drop policy if exists "Admins can insert form responses" on public.form_responses;
-- create policy "Anyone can submit form responses"
--   on public.form_responses for insert
--   to anon, authenticated
--   with check (true);
-- ==========================================
