-- ==========================================
-- MIGRASI 003: Perketat RLS admin dengan is_admin()
-- TAHAP 2 dari 3 — JALANKAN HANYA SETELAH:
--   - migration 002 diterapkan (fungsi is_admin() + seed admin ada), DAN
--   - kode aplikasi dengan requireAdmin() sudah dideploy & terverifikasi.
-- ==========================================
-- TUJUAN: mengganti policy "to authenticated using (true)" yang terlalu
-- permisif (user manapun yang login = admin penuh) dengan pengecekan
-- is_admin(). Berlaku untuk: forms (write), form_responses (read/delete),
-- selection_results (semua), storage form-attachments (delete/update).
--
-- TIDAK mengubah:
--   - forms SELECT publik (is_open = true) -> tetap bisa baca form terbuka,
--   - form_responses INSERT anon/authenticated -> tetap (sampai migration 004),
--   - storage INSERT anon (upload lampiran publik) & SELECT publik.
--
-- TIDAK DROP tabel/kolom, TIDAK menonaktifkan RLS.
-- ==========================================

-- ---------- 1. forms: write khusus admin ----------
drop policy if exists "Admins can insert forms" on public.forms;
drop policy if exists "Admins can update forms" on public.forms;
drop policy if exists "Admins can delete forms" on public.forms;

create policy "Admins can insert forms"
  on public.forms for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update forms"
  on public.forms for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete forms"
  on public.forms for delete
  to authenticated
  using (public.is_admin());

-- Policy SELECT admin "Admins can view all forms" (existing, using (true))
-- DIPERTAHANKAN sengaja: supaya admin tetap bisa melihat form tertutup di
-- dashboard. CREATE/UPDATE/DELETE di atas sudah jadi pintu gerbang utama.
-- (Catatan: ini hanya soa SELECT; bukan celah tulis.)

-- ---------- 2. form_responses: read/delete khusus admin ----------
drop policy if exists "Admins can view form responses" on public.form_responses;
drop policy if exists "Admins can delete form responses" on public.form_responses;

create policy "Admins can view form responses"
  on public.form_responses for select
  to authenticated
  using (public.is_admin());

create policy "Admins can delete form responses"
  on public.form_responses for delete
  to authenticated
  using (public.is_admin());

-- INSERT anon tetap (policy "Anyone can submit form responses") sampai
-- migration 004 dijalankan setelah alur server action terverifikasi.

-- ---------- 3. selection_results: khusus admin ----------
-- Policy lama: "for all to authenticated using (true) with check (true)"
-- (siapapun yang login bisa baca SEMUA hasil seleksi).
-- /api/cek-hasil memakai SERVICE ROLE (bypass RLS), sehingga fitur cek hasil
-- publik TETAP berfungsi setelah pembatasan ini.
drop policy if exists "Admins can manage selection results" on public.selection_results;

create policy "Admins can manage selection results"
  on public.selection_results for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 4. storage form-attachments: delete/update khusus admin ----------
drop policy if exists "Admins can delete files from form-attachments" on storage.objects;
drop policy if exists "Admins can update files from form-attachments" on storage.objects;

create policy "Admins can delete files from form-attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'form-attachments' and public.is_admin());

create policy "Admins can update files from form-attachments"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'form-attachments' and public.is_admin());

-- Policy upload (anon+auth INSERT, whitelist extension) & view (publik SELECT)
-- DIPERTAHANKAN: diperlukan untuk upload lampiran form publik.

-- ==========================================
-- ROLLBACK
-- ==========================================
-- Pulihkan policy permisif lama (urutan bebas):
--
-- drop policy if exists "Admins can insert forms" on public.forms;
-- drop policy if exists "Admins can update forms" on public.forms;
-- drop policy if exists "Admins can delete forms" on public.forms;
-- create policy "Admins can insert forms" on public.forms
--   for insert to authenticated with check (true);
-- create policy "Admins can update forms" on public.forms
--   for update to authenticated using (true) with check (true);
-- create policy "Admins can delete forms" on public.forms
--   for delete to authenticated using (true);
--
-- drop policy if exists "Admins can view form responses" on public.form_responses;
-- drop policy if exists "Admins can delete form responses" on public.form_responses;
-- create policy "Admins can view form responses" on public.form_responses
--   for select to authenticated using (true);
-- create policy "Admins can delete form responses" on public.form_responses
--   for delete to authenticated using (true);
--
-- drop policy if exists "Admins can manage selection results" on public.selection_results;
-- create policy "Admins can manage selection results" on public.selection_results
--   for all to authenticated using (true) with check (true);
--
-- drop policy if exists "Admins can delete files from form-attachments" on storage.objects;
-- drop policy if exists "Admins can update files from form-attachments" on storage.objects;
-- create policy "Admins can delete files from form-attachments" on storage.objects
--   for delete to authenticated using (bucket_id = 'form-attachments');
-- create policy "Admins can update files from form-attachments" on storage.objects
--   for update to authenticated using (bucket_id = 'form-attachments');
-- ==========================================
