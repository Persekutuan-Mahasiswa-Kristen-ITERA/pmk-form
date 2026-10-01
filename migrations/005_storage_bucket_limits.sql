-- ==========================================
-- MIGRASI 005: Hardening bucket storage form-attachments
-- Jalankan kapan saja (aman); disarankan bersamaan dengan migration 003.
-- ==========================================
-- TUJUAN: membatasi upload di level bucket sehingga meski ada client yang
-- mem-bypass server action (upload langsung ke Storage pakai anon key), tetap
-- ditolak oleh server Storage:
--   - file_size_limit  = 10 MB (sama dengan MAX_FILE_SIZE di server action)
--   - allowed_mime_types = whitelist yang sama dengan ALLOWED_FILE_TYPES
--     (PDF, JPG, PNG, DOC, DOCX)
--
-- Catatan: allowed_mime_types memeriksa MIME berdasarkan extension + deteksi
-- server Storage. Server action juga memeriksa extension secara eksplisit
-- (ALLOWED_EXTENSIONS) untuk defense-in-depth.
--
-- Aman: hanya UPDATE baris bucket. Tidak menghapus bucket/file/policy.
-- ==========================================

update storage.buckets
set
  file_size_limit = 10485760, -- 10 * 1024 * 1024 bytes
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  updated_at = now()
where id = 'form-attachments';

-- ==========================================
-- VERIFIKASI (read-only, jalankan setelahnya)
-- ==========================================
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'form-attachments';
--
-- Hasil yang diharapkan:
--   id= form-attachments | public= true | file_size_limit= 10485760
--   allowed_mime_types= {application/pdf, image/jpeg, image/png,
--                        application/msword, application/vnd...wordprocessingml.document}
--
-- Uji penolakan upload (opsional, pakai anon key di Supabase Storage API):
--   - file 15 MB -> harus ditolak (413 / Payload Too Large)
--   - file .exe atau .zip -> harus ditolak (unsupported mime type)
--
-- ROLLBACK:
-- update storage.buckets
-- set file_size_limit = null, allowed_mime_types = null, updated_at = now()
-- where id = 'form-attachments';
-- ==========================================
