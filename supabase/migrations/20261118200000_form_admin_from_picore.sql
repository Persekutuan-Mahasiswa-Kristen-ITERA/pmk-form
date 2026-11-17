-- pmk-form admins can be managed in PI-CORE > Integrasi > pmk-form (PI-CORE D-16).
-- form.is_admin() now accepts EITHER the legacy invite list (form.admin_members, unchanged) OR the
-- PI-CORE app role `admin` for app `form` (public.my_app_roles('form')). Nobody loses access:
-- the PI-CORE migration 20261118500000_app_form gave every active invited admin with a PI-CORE
-- account a member rule. my_app_roles() already refuses deactivated members and temporary passwords.
-- Requires PI-CORE's public.my_app_roles (PI-CORE migration 20261118100000_app_access).

create or replace function form.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from form.admin_members am
    join public.members m on m.user_id = am.user_id
    where am.user_id = (select auth.uid())
      and am.status = 'active'
      and m.is_active
  )
  or 'admin' = any (public.my_app_roles('form'));
$$;
comment on function form.is_admin() is
  'TRUE if the caller has an active form.admin_members row (legacy invite list) or the PI-CORE app role admin for pmk-form, and an active PI-CORE member row.';
