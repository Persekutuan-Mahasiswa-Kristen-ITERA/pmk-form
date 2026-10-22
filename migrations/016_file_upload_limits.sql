-- MIGRASI 016: batas lampiran form generik
-- Jalankan di Supabase setelah deploy aplikasi.
-- Server action dan client juga menolak file di atas 512 KB serta form dengan
-- lebih dari 10 field upload.

update storage.buckets
set
  file_size_limit = 524288, -- 512 * 1024 bytes
  updated_at = now()
where id = 'form-attachments';

-- Verifikasi:
-- select id, file_size_limit
-- from storage.buckets
-- where id = 'form-attachments';
-- Hasil: file_size_limit = 524288
