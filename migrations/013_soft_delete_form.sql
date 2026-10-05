-- ==========================================
-- MIGRASI 013: Soft delete form (Fase 7 item 6)
-- NON-DESTRUKTIF: hanya TAMBAH kolom + index + constraint.
-- ==========================================
-- TUJUAN: form dengan respons TIDAK bisa di-hard-delete (Fase 4C), tapi
-- admin butuh cara menyembunyikan form lama dari dashboard tanpa kehilangan
-- data + riwayat status. Solusi: soft delete — tandai form sebagai dihapus,
-- sembunyikan dari aplikasi, tapi baris + respons tetap utuh di DB.
--
-- PRINSIP:
--   - forms.is_deleted boolean NOT NULL DEFAULT false (data lama = false).
--   - deleted_at timestamptz NULL untuk jejak kapan dihapus.
--   - Query aplikasi memfilter is_deleted = false (getAllForms, getFormBySlug,
--     getFormById). Migrasi ini hanya skema; filter di KODE (branch ini).
--   - Tidak ada data yang dihapus; rollback aman (drop kolom saja).
--
-- !!! SETELAH MIGRASI INI, semua query baca forms di aplikasi WAJIB memfilter
--     is_deleted = false. Bila tidak, form yang "dihapus" tetap muncul.
--     Itu dikerjakan di kode branch feat/soft-delete-form.
-- ==========================================

begin;

-- ==========================================
-- LANGKAH 1: Kolom soft delete
-- ==========================================
-- NOT NULL DEFAULT false: semua baris lama langsung false (tidak dihapus).
alter table public.forms
  add column if not exists is_deleted boolean not null default false;

alter table public.forms
  add column if not exists deleted_at timestamptz;

comment on column public.forms.is_deleted is
  'Soft delete: true = form disembunyikan dari aplikasi (dashboard + landing), '
  'tapi baris + respons tetap utuh. Dihard-delete hanya bila kosong.';

comment on column public.forms.deleted_at is
  'Timestamp kapan form di-soft-delete (audit), NULL bila belum dihapus.';

-- ==========================================
-- LANGKAH 2: Index untuk filter is_deleted
-- ==========================================
-- Query paling sering: "form aktif yang tidak dihapus" (dashboard + landing).
-- Partial index hanya baris is_deleted = false (hampir semua) -> kecil & cepat.
create index if not exists idx_forms_active
  on public.forms (created_at desc)
  where is_deleted = false;

-- Index untuk halaman "sampah" (form yang di-soft-delete), jarang dipakai
-- tapi tetap diberi agar admin tidak scan full table.
create index if not exists idx_forms_deleted
  on public.forms (deleted_at desc)
  where is_deleted = true;

commit;

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only)
-- ==========================================
-- V1. Kolom ada dengan default yang benar:
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_name = 'forms' and column_name in ('is_deleted','deleted_at');
--   -- is_deleted | boolean | NO  | false
--   -- deleted_at | timestamp with time zone | YES | (null)
--
-- V2. Data lama SEMUA false (tidak ada yang tiba-tiba "dihapus"):
--
--   select count(*) filter (where is_deleted) as terhapus,
--          count(*) filter (where not is_deleted) as aktif,
--          count(*) as total
--   from public.forms;
--   -- harus: terhapus = 0, aktif = total (8 form produksi)
--
-- V3. Index ada:
--
--   select indexname from pg_indexes
--   where tablename = 'forms' and indexname like 'idx_forms_%';
--   -- harus: idx_forms_active, idx_forms_deleted ( + index lama )
--
-- V4. Default berlaku untuk insert baru:
--
--   begin;
--   insert into public.forms (title, slug, form_type, open_date, close_date)
--   values ('test-soft-delete', 'test-soft-delete-slug', 'general',
--           now(), now() + interval '1 day')
--   returning id, is_deleted, deleted_at;
--   -- harus: is_deleted = false, deleted_at = (null)
--   rollback;

-- ==========================================
-- ROLLBACK (AMAN — hanya menghapus kolom baru)
-- ==========================================
-- Tidak ada data yang dibuat migration ini. Kolom is_deleted/deleted_at
-- di-drop; data form + respons TIDAK terpengaruh.
--
-- !!! Bila sudah ada form yang di-soft-delete (is_deleted = true), rollback
--     akan MENGHAPUS tanda penghapusan itu — form "keluar dari sampah" dan
--   muncul lagi di dashboard. Pertimbangkan dua kali.
--
--   begin;
--   drop index if exists public.idx_forms_active;
--   drop index if exists public.idx_forms_deleted;
--   alter table public.forms drop column if exists deleted_at;
--   alter table public.forms drop column if exists is_deleted;
--   commit;
--
-- CATATAN JUJUR:
--   - Soft delete hanya menyembunyikan form dari APLIKASI. Data tetap ada di
--     DB (itulah intinya). Backup terpisah tetap tanggung jawab Supabase.
--   - Tidak ada mekanisme purge otomatis (hard-delete form berisi respons
--     tetap diblokir deleteForm di kode). Admin bisa purge manual via
--     service role bila benar-benar perlu (kasus langka).
-- ==========================================
