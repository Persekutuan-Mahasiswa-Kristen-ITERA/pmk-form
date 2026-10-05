-- ==========================================
-- MIGRASI 011: Status respons (diterima / lolos / tidak lolos)
-- FASE 7 item 3 — JALANKAN SEBELUM DEPLOY KODE. NON-DESTRUKTIF (hanya TAMBAH).
-- ==========================================
-- TUJUAN: tambah kolom `status` di form_responses supaya pengurus bisa
-- menandai hasil seleksi per respons. Ini menggantikan kebutuhan tabel
-- legacy selection_results (yang akan dipensiunkan beserta /hasil & /api/cek-hasil).
--
-- PRINSIP:
--   - form_responses tetap SUMBER KEBENENARAN. Status hanya metadata proses.
--   - Non-destructive: hanya TAMBAH kolom + index. Data lama TIDAK disentuh
--     (semua baris lama => status NULL = "belum diproses").
--   - Tidak ada RLS yang dinonaktifkan. Aksi UPDATE status hanya admin.
--
-- Siklus nilai status:
--   NULL           = belum diproses (default, SEMUA data lama)
--   'diterima'     = diterima / lolos tahap ini
--   'tidak_lolos'  = ditolak / tidak lolos
--   'cadangan'     = waiting list / cadangan
-- ==========================================

begin;

-- ==========================================
-- LANGKAH 1: Kolom status di form_responses
-- ==========================================
-- text + CHECK constraint: hanya nilai yang diizinkan (atau NULL).
-- DEFAULT NULL eksplisit agar data lama jelas "belum diproses".
alter table public.form_responses
  add column if not exists status text
    check (status is null or status in ('diterima', 'tidak_lolos', 'cadangan'));

comment on column public.form_responses.status is
  'Status proses seleksi per respons: NULL = belum diproses, '
  '''diterima'', ''tidak_lolos'', ''cadangan''. Diupdate admin saja. '
  'Menggantikan kebutuhan tabel legacy selection_results.';

-- ==========================================
-- LANGKAH 2: Index untuk filter status (admin dashboard)
-- ==========================================
-- Partial index: hanya baris yang sudah diproses (filter paling sering
-- di admin: "yang sudah diproses" / "yang diterima").
create index if not exists idx_form_responses_status
  on public.form_responses (form_id, status)
  where status is not null;

-- ==========================================
-- LANGKAH 3: Policy UPDATE status hanya admin
-- ==========================================
-- Admin sudah punya policy SELECT & DELETE (migration 003). Tambah UPDATE
-- khusus kolom status: hanya is_admin(). Pendaftar publik TIDAK bisa
-- mengubah status jawabannya sendiri (RLS + service role dua-duanya).
drop policy if exists "Admins can update response status" on public.form_responses;
create policy "Admins can update response status"
  on public.form_responses for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only)
-- ==========================================
-- V1. Kolom status ada:
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'form_responses' and column_name = 'status';
--   -- harus 1 baris: status | text | YES
--
-- V2. Index status ada:
--
--   select indexname from pg_indexes
--   where tablename = 'form_responses' and indexname = 'idx_form_responses_status';
--   -- harus: idx_form_responses_status
--
-- V3. Policy UPDATE hanya admin:
--
--   select policyname, cmd from pg_policies where tablename = 'form_responses';
--   -- harus ada: "Admins can update response status" | UPDATE
--
-- V4. Data lama tidak berubah (semua status NULL):
--
--   select count(*) as total,
--          count(*) filter (where status is not null) as ada_status,
--          count(*) filter (where status is null) as belum_diproses
--   from public.form_responses;
--   -- harus: total = 240 (atau jumlah saat ini), ada_status = 0,
--   --        belum_diproses = total
--
-- V5. Test CHECK constraint (ROLLBACK otomatis bila nilai invalid):
--
--   begin;
--   update public.form_responses set status = 'invalid' limit 1;
--   -- harus ERROR: new row for relation "form_responses" violates check
--   rollback;

-- ==========================================
-- ROLLBACK (AMAN — hanya menghapus objek baru)
-- ==========================================
-- Tidak ada data yang dibuat migration ini (kolom masih NULL semua).
--
--   begin;
--   drop policy if exists "Admins can update response status" on public.form_responses;
--   drop index if exists public.idx_form_responses_status;
--   alter table public.form_responses drop column if exists status;
--   commit;
--
-- CATATAN JUJUR:
--   - Bila sudah ada status yang diisi admin, rollback MENGHAPUS info itu
--     (kolom status di-drop). form_responses.answers tetap utuh.
--   - Pensiun /hasil & /api/cek-hasil TIDAK dilakukan migration ini —
--     itu di kode (hapus file), bukan di DB. Tabel legacy selection_results
--     TIDAK dihapus (data 54 baris tetap ada, cuma tidak dipakai aplikasi).
-- ==========================================
