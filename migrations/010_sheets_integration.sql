-- ==========================================
-- MIGRASI 010: Integrasi Google Sheets (config + outbox)
-- FASE 6-2 — JALANKAN SEBELUM DEPLOY KODE. NON-DESTRUKTIF (hanya TAMBAH).
-- ==========================================
-- TUJUAN: setiap respons form otomatis dimirror satu arah ke Google
-- Spreadsheet. form_responses tetap SUMBER KEBENARAN; Sheets hanya mirror.
-- Kegagalan Google TIDAK boleh menggagalkan submit pendaftar.
--
-- PRINSIP DESAIN (disetujui di CHECKPOINT 6.2):
--   - Config per form disimpan sebagai kolom JSONB `sheets_config` di tabel
--     forms (mengikuti pola `settings` yang sudah ada). Lebih sederhana
--     daripada tabel terpisah; 1 form = 1 spreadsheet.
--   - Outbox: tabel `sheets_outbox` untuk sinkronisasi best-effort + retry.
--   - RLS: config & outbox hanya boleh dibaca/ditulis admin (is_admin()).
--     Service role (server action) bypass RLS — itu jalur utama insert
--     outbox saat submit publik.
--
-- TIDAK ADA data lama yang disentuh. Tidak ada RLS yang dinonaktifkan.
-- ==========================================

begin;

-- ==========================================
-- LANGKAH 1: Kolom sheets_config di forms
-- ==========================================
-- JSONB agar fleksibel tanpa migration ulang saat field config bertambah.
-- NULL default: form tanpa konfigurasi = tidak ada integrasi Sheets.
--
-- Bentuk yang disimpan aplikasi:
--   { "spreadsheet_id": "1AbC...", "sheet_name": "Sheet1", "enabled": true }
alter table public.forms
  add column if not exists sheets_config jsonb;

comment on column public.forms.sheets_config is
  'Konfigurasi mirror Google Sheets per form: '
  '{spreadsheet_id, sheet_name, enabled}. NULL = tanpa integrasi Sheets. '
  'form_responses tetap sumber kebenaran; Sheets hanya mirror satu arah.';

-- ==========================================
-- LANGKAH 2: Tabel outbox sheets_outbox
-- ==========================================
create table if not exists public.sheets_outbox (
  -- response_id adalah PK + unique: SATU baris per respons (idempoten).
  -- Retry tidak pernah membuat duplikat baris outbox.
  response_id uuid primary key references public.form_responses(id) on delete cascade,
  form_id uuid not null references public.forms(id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'synced', 'failed')),

  -- Jumlah percobaan sinkronisasi (untuk backoff & batas percobaan).
  attempts int not null default 0,

  -- Kapan harus dicoba lagi (exponential backoff). NULL saat pending awal.
  next_attempt_at timestamptz,

  -- ERROR YANG SUDAH DISANITASI: hanya kode/pesan teknis umum.
  -- !!! DILARANG memuat isi jawaban responden (PII: NIM, nama, email)
  -- !!! atau secret (token/key). Lihat lib/sheets/client.ts.
  last_error text,

  synced_at timestamptz,

  created_at timestamptz not null default now()
);

-- Index untuk query cron: ambil baris yang perlu dicoba (pending atau failed
-- yang sudah lewat next_attempt_at), diurutkan per form untuk batching.
create index if not exists idx_sheets_outbox_pending
  on public.sheets_outbox (form_id, next_attempt_at)
  where status in ('pending', 'failed');

-- Index untuk statistik UI (jumlah pending/failed per form).
create index if not exists idx_sheets_outbox_status
  on public.sheets_outbox (form_id, status);

alter table public.sheets_outbox enable row level security;

-- RLS: hanya admin (is_admin()) yang baca/kelola outbox.
-- Insert saat submit publik dilakukan LEWAT SERVICE ROLE (bypass RLS) di
-- server action — bukan lewat client anon. Lihat app/actions/submitResponse.ts.
drop policy if exists "Admins can manage sheets_outbox" on public.sheets_outbox;
create policy "Admins can manage sheets_outbox"
  on public.sheets_outbox for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only)
-- ==========================================
-- V1. Kolom sheets_config ada di forms:
--
--   select column_name, data_type from information_schema.columns
--   where table_name = 'forms' and column_name = 'sheets_config';
--   -- harus 1 baris: sheets_config | jsonb
--
-- V2. Tabel outbox + index ada:
--
--   select tablename from pg_tables where tablename = 'sheets_outbox';
--   select indexname from pg_indexes
--   where tablename = 'sheets_outbox' order by indexname;
--   -- harus: idx_sheets_outbox_pending, idx_sheets_outbox_status
--
-- V3. Policy outbox hanya is_admin():
--
--   select policyname, cmd from pg_policies
--   where tablename = 'sheets_outbox';
--   -- harus: "Admins can manage sheets_outbox" | ALL
--
-- V4. Form tetap utuh (data lama tidak berubah):
--
--   select count(*) as total_forms from public.forms;          -- harus tetap 8
--   select count(*) as total_responses from public.form_responses;  -- harus tetap 240
--   select count(*) as sheets_null from public.forms where sheets_config is null;
--   -- harus 8 (semua form belum terintegrasi)

-- ==========================================
-- ROLLBACK (AMAN — hanya menghapus objek baru)
-- ==========================================
-- Tidak ada data produksi yang dibuat migration ini (kolom masih NULL semua,
-- tabel outbox masih kosong saat pertama dijalankan).
--
--   begin;
--   drop policy if exists "Admins can manage sheets_outbox" on public.sheets_outbox;
--   drop index if exists public.idx_sheets_outbox_status;
--   drop index if exists public.idx_sheets_outbox_pending;
--   drop table if exists public.sheets_outbox;
--   alter table public.forms drop column if exists sheets_config;
--   commit;
--
-- CATATAN JUJUR:
--   - Baris outbox yang sudah ada (pending/failed) ikut hilang. Itu wajar:
--     rollback berarti menonaktifkan fitur Sheets; respons di form_responses
--     TIDAK hilang (sumber kebenaran tetap utuh).
--   - Jika rollback dilakukan setelah beberapa respons sudah synced ke sheet,
--     data di sheet TETAP ADA (satu arah — kita tidak pernah menghapus baris
--     sheet saat rollback). Hapus manual dari sheet bila perlu.
-- ==========================================
