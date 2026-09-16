-- ==========================================
-- ROLLBACK 001: Kembalikan ke schema lama (recruitments + submissions)
-- JALANKAN HANYA JIKA MIGRASI GAGAL / PERLU REVERT
-- ==========================================

-- PERINGATAN: Rollback ini HANYA menghapus tabel & policy BARU.
-- Data di tabel lama (recruitments, submissions) TIDAK TERHAPUS karena tidak pernah di-drop.

-- 1. Hapus policy & trigger baru
drop policy if exists "Super admin can manage all roles" on public.user_roles;
drop policy if exists "User can view own role" on public.user_roles;
drop table if exists public.user_roles;

drop policy if exists "Public can view open forms" on public.forms;
drop policy if exists "Admins can view all forms" on public.forms;
drop policy if exists "Admins can insert forms" on public.forms;
drop policy if exists "Admins can update forms" on public.forms;
drop policy if exists "Admins can delete forms" on public.forms;
drop trigger if exists handle_forms_updated_at on public.forms;
drop table if exists public.forms;

drop policy if exists "Anyone can submit form responses" on public.form_responses;
drop policy if exists "Admins can view form responses" on public.form_responses;
drop policy if exists "Admins can delete form responses" on public.form_responses;
drop trigger if exists handle_form_responses_updated_at on public.form_responses;
drop table if exists public.form_responses;

drop trigger if exists handle_selection_results_updated_at on public.selection_results;

-- 2. Hapus storage policies untuk form-attachments
drop policy if exists "Anyone can upload files to form-attachments" on storage.objects;
drop policy if exists "Anyone can view files from form-attachments" on storage.objects;
drop policy if exists "Admins can delete files from form-attachments" on storage.objects;
drop policy if exists "Admins can update files from form-attachments" on storage.objects;

-- 3. Hapus bucket form-attachments (opsional, hati-hati jika sudah ada file)
-- delete from storage.buckets where id = 'form-attachments';

-- 4. Schema lama (recruitments, submissions) tetap utuh - tidak diubah
-- Jika perlu hapus data migrasi yang sudah masuk:
-- delete from public.forms where form_type = 'recruitment';
-- delete from public.form_responses where form_id in (select id from public.recruitments);

select 'Rollback completed. Tabel lama (recruitments, submissions) tidak tersentuh.' as status;