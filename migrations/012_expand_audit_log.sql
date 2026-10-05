-- ==========================================
-- MIGRASI 012: Perluas audit log ke semua aksi admin (Fase 7 item 5)
-- NON-DESTRUKTIF: hanya melonggarkan CHECK constraint + tambah index.
-- ==========================================
-- TUJUAN: tabel admin_audit_log (Fase 5, migration 009) hanya mengizinkan
-- aksi manajemen admin (invite/update_role/dst). Fase 7 item 5 memperluasnya
-- supaya SEMUA aksi admin penting tercatat: create/update/delete/duplicate
-- form, toggle form, delete respons, update status respons, sheets config.
--
-- PRINSIP (dipertahankan dari Fase 5):
--   - Append-only: TIDAK ADA policy UPDATE/DELETE. Baris tidak bisa diubah
--     atau dihapus, bahkan oleh admin, kecuali via service role (opsional,
--     tidak digunakan aplikasi).
--   - INSERT/SELECT hanya admin (policy migration 009 tetap, tidak disentuh).
--   - Data lama TIDAK diubah — hanya constraint yang dilonggarkan.
--
-- Daftar aksi baru (detail jsonb menyimpan konteks, mis. form slug/judul):
--   form_create, form_update, form_delete, form_duplicate, form_toggle,
--   response_delete, response_status_update, sheets_config_save
-- ==========================================

begin;

-- ==========================================
-- LANGKAH 1: Longgarkan CHECK constraint pada kolom action
-- ==========================================
-- DROP + ADD: tidak menghapus baris (data lama tetap valid di constraint baru).
alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_action_check;

alter table public.admin_audit_log
  add constraint admin_audit_log_action_check
  check (action in (
    -- Aksi manajemen admin (Fase 5, migration 009) — dipertahankan.
    'invite', 'reinvite', 'update_role', 'activate', 'disable', 'delete', 'self_link',
    -- Aksi form (Fase 7 item 5).
    'form_create', 'form_update', 'form_delete', 'form_duplicate', 'form_toggle',
    -- Aksi respons (Fase 7 item 3 + 5).
    'response_delete', 'response_status_update',
    -- Aksi integrasi Sheets (Fase 6).
    'sheets_config_save'
  ));

comment on table public.admin_audit_log is
  'Audit log append-only untuk SEMUA aksi admin (Fase 5 + Fase 7 item 5). '
  'Tidak ada policy UPDATE/DELETE — baris tidak bisa diubah/dihapus.';

-- ==========================================
-- LANGKAH 2: Index untuk membaca audit log (urut created_at)
-- ==========================================
-- Halaman viewer membaca baris terbaru dulu. Partial index kosong sampai
-- ada insert, jadi tidak ada overhead untuk data lama.
create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);

commit;

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only)
-- ==========================================
-- V1. Constraint baru ada:
--
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.admin_audit_log'::regclass
--     and conname = 'admin_audit_log_action_check';
--   -- harus mengandung 'form_create' dan 'response_status_update'
--
-- V2. Aksi baru diterima:
--
--   begin;
--   insert into public.admin_audit_log (action, detail)
--   values ('form_create', '{"slug":"test"}');
--   -- harus INSERT 0 1 (RLS mengizinkan admin)
--   rollback;
--
-- V3. Aksi invalid masih ditolak:
--
--   begin;
--   insert into public.admin_audit_log (action) values ('invalid');
--   -- harus ERROR: violates check constraint
--   rollback;
--
-- V4. Data lama utuh:
--
--   select count(*) from public.admin_audit_log;
--   -- harus sama dengan sebelum migration
--
-- V5. Index ada:
--
--   select indexname from pg_indexes
--   where tablename = 'admin_audit_log';
--   -- harus: idx_admin_audit_log_created_at

-- ==========================================
-- ROLLBACK (AMAN — mengembalikan constraint lama)
-- ==========================================
-- !!! HATI-HATI: bila sudah ada baris dengan aksi baru (form_create, dst),
-- rollback akan MENOLAK (constraint lama tidak mengizinkan aksi itu).
-- Hapus baris aksi baru dulu (memang harus via service role karena tidak
-- ada policy DELETE), baru constraint bisa dikembalikan:
--
--   begin;
--   -- drop index
--   drop index if exists public.idx_admin_audit_log_created_at;
--   -- kembalikan constraint Fase 5 (polos, tanpa klausa NOT VALID)
--   alter table public.admin_audit_log
--     drop constraint if exists admin_audit_log_action_check;
--   alter table public.admin_audit_log
--     add constraint admin_audit_log_action_check
--     check (action in (
--       'invite', 'reinvite', 'update_role', 'activate', 'disable',
--       'delete', 'self_link'
--     ));
--   commit;
-- ==========================================
