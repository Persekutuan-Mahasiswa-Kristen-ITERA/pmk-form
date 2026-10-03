-- ==========================================
-- MIGRASI 008: Unique NIM per form via nim_normalized (Fase 3-5)
-- ==========================================
-- Asal-usul: ini versi FINAL dari usulan migration 006. Lihat
-- migrations/006_PROPOSAL_unique_nim_per_form.sql untuk analisis lengkap
-- (mengapa tidak pakai index langsung pada answers->>'field_applicant_nim',
-- mengapa tidak pakai trigger, dst).
--
-- RINGKASAN:
--   - Kolom `nim_normalized` nullable, DIISI OLEH SERVER ACTION (bukan client,
--     bukan trigger). Lihat app/actions/submitResponse.ts.
--   - Unique PARTIAL index (form_id, nim_normalized) WHERE nim_normalized IS
--     NOT NULL -> hanya baris baru yang terkena.
--   - DATA LAMA TIDAK DISENTUH: baris lama tetap NULL -> tidak masuk index.
--     5 pasang duplikat NIM yang sudah ada diterima (keputusan Fase 0).
--   - Form TANPA field identitas (survey/presensi) -> kolom NULL -> bebas.
--
-- CARA MENJALANKAN (WAJIB baca dulu):
--   Supabase SQL Editor menjalankan statement dalam transaction block, dan
--   CREATE INDEX CONCURRENTLY tidak bisa dijalankan dalam transaksi. Karena
--   tabel hanya ~240 baris, dipakai index NON-concurrent (lock singkat tidak
--   bermasalah). Jalankan SELURUH file ini sekaligus di SQL Editor.
--
-- URUTAN ROLLOUT (jangan dibalik):
--   1. Backup DB (sudah jadi cadangan kebijakan; lihat docs/PROGRESS.md).
--   2. Deploy kode Fase 3 terlebih DAHULU, lalu jalankan migration ini.
--      (Server action butuh kolom `nim_normalized` ada; jika migration
--       dijalankan setelahnya, submit akan error sampai kolom dibuat.)
--      Catatan: untuk minimisasi risiko, deploy dilakukan dulu, dan migration
--      ini segera dijalankan setelahnya. Jika ada submit di antara dua tahap
--      itu sebelum kolom ada, server action menangani error secara graceful
--      (lihat penanganan 42703 di submitResponse).
--   3. Verifikasi dengan query di LANGKAH 4.
--
-- ROLLBACK (aman, tidak ada data yang hilang):
--   drop index if exists public.idx_form_responses_nim_normalized;
--   alter table public.form_responses drop column if exists nim_normalized;
-- ==========================================

begin;

-- LANGKAH 1: Tambah kolom nullable (baris lama -> NULL, tidak melanggar apa pun).
alter table public.form_responses
  add column if not exists nim_normalized text;

comment on column public.form_responses.nim_normalized is
  'NIM yang sudah dinormalisasi (upper + trim + hapus karakter non-alfanumerik). '
  'Diisi server action saat submit. Unique PARTIAL index memastikan NIM unik '
  'per form. NULL untuk form tanpa field identitas dan untuk baris lama.';

-- LANGKAH 2: Unique PARTIAL index. Tanpa CONCURRENTLY (lihat catatan di atas).
create unique index if not exists idx_form_responses_nim_normalized
  on public.form_responses (form_id, nim_normalized)
  where nim_normalized is not null;

commit;

-- ==========================================
-- LANGKAH 3: Verifikasi (read-only, jalankan manual setelah migration)
-- ==========================================

-- 3a. Index ada?
--   select indexname, indexdef
--   from pg_indexes
--   where tablename = 'form_responses'
--     and indexname = 'idx_form_responses_nim_normalized';

-- 3b. Duplikat yang lolos (harus 0 setelah aplikasi mengisi kolom):
--   select form_id, nim_normalized, count(*)
--   from public.form_responses
--   where nim_normalized is not null
--   group by form_id, nim_normalized
--   having count(*) > 1;

-- 3c. DRY-RUN: duplikat di DATA LAMA (informasi saja, TIDAK ada aksi).
--     Hasil saat penulisan: 5 pasang, semuanya count=2. Diterima.
--   select
--     fr.form_id,
--     fr.answers->>'field_applicant_nim' as nim,
--     count(*) as dup_count
--   from public.form_responses fr
--   where fr.answers ? 'field_applicant_nim'
--     and coalesce(fr.answers->>'field_applicant_nim', '') <> ''
--   group by fr.form_id, fr.answers->>'field_applicant_nim'
--   having count(*) > 1;

-- ==========================================
-- BACKFILL: OPSIONAL, DIHINDARI sesuai keputusan (data lama tidak disentuh).
-- Jika kelak diinginkan, jalankan terpisah dengan penanganan duplikat
-- (DISTINCT ON per pasang). Tidak disertakan di sini demi keselamatan data.
-- ==========================================
