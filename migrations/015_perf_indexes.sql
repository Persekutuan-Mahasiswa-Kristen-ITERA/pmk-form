-- ==========================================
-- 015 — Index performa + konsistensi policy RLS
-- ==========================================
-- Tujuan: mempercepat halaman respons admin (filter form_id + order
-- submitted_at desc) dan menyelaraskan policy "own row" admin_members dengan
-- pola yang direkomendasikan Supabase ((select auth.uid())).
--
-- !!! BELUM DIJALANKAN ke production — menunggu persetujuan. Jalankan manual
--     di Supabase Studio / psql setalah review. Semua perintah idempoten
--     (if not exists / drop policy if exists).
--
-- Dampak terhadap data production:
-- - CREATE INDEX: hanya menulis metadata index. Tabel form_responses kecil
--   (~240 baris) jadi cepat, tetap jalan di transaction (bukan CONCURRENTLY).
-- - DROP POLICY + CREATE POLICY: tidak mengubah data, hanya teks policy.
--   window sangat singkat; akses admin selama itu tetap melalui policy
--   "admin_members select" (is_admin) yang lain.
--
-- Catatan: banyak index penting SUDAH ada (lihat 001/011/013), antara lain
-- idx_forms_active (created_at desc where is_deleted=false) yang sudah
-- mengcover getAllForms, dan idx_sheets_outbox_status (form_id, status) yang
-- sudah mengcover getSheetsStatus. Index di bawah hanya mengisi sisa celah.

begin;

-- Composite index: query "respons form X terbaru dulu" (halaman respons admin
-- + export CSV/ZIP) sekarang tercover satu index scan, bukan gabungan bitmap
-- dari idx_form_responses_form_id + idx_form_responses_submitted_at.
create index if not exists idx_form_responses_form_submitted
  on public.form_responses (form_id, submitted_at desc);

-- Supabase menyarankan (select auth.uid()) pada policy RLS supaya planner
-- PostgreSQL dapat meng-cache plan (tidak re-parse auth.uid() per session).
-- Policy lama memakai auth.uid() mentah — berfungsi, tapi tidak optimal.
drop policy if exists "Users can view own admin_members row" on public.admin_members;
create policy "Users can view own admin_members row"
  on public.admin_members for select
  to authenticated
  using (user_id = (select auth.uid()));

commit;

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only)
-- ==========================================
-- select indexname, indexdef from pg_indexes
--   where tablename in ('form_responses')
--   and indexname = 'idx_form_responses_form_submitted';
--
-- select policyname, using from pg_policies
--   where tablename = 'admin_members'
--   and policyname = 'Users can view own admin_members row';
