-- MIGRASI 014: batasi kolom forms yang bisa dibaca publik.
-- RLS mengatur BARIS, bukan kolom. Tanpa ini, anon dapat meminta
-- `sheets_config` langsung lewat PostgREST walau aplikasi memakai allow-list.
begin;

revoke select (created_by, sheets_config) on public.forms from anon;
-- authenticated admin tetap membutuhkan seluruh kolom pada dashboard.
grant select (id, title, description, slug, form_type, is_open, open_date,
  close_date, form_fields, settings, created_at, updated_at, is_deleted,
  deleted_at) on public.forms to anon;

commit;