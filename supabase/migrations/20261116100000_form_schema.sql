-- =============================================================================================
-- PMK-FORM on the PI-CORE Supabase project: schema `form`.
--
-- pmk-form used to run on its own Supabase project (tables in `public`, own Auth). It now lives
-- in the SAME project as PI-CORE and PMK-NEXUS:
--   * Login = PI-CORE's Supabase Auth (accounts are created by PI-CORE admins, no sign-up).
--   * Admins are still invited by email through `form.admin_members` (the existing invite flow);
--     an invite becomes active when a PI-CORE account with that email logs in to pmk-form.
--   * File uploads live in Cloudflare R2 (private), NOT in Supabase Storage. Tables store object keys.
--
-- Ownership: this file creates and changes objects in schema `form` ONLY. PI-CORE's `public` and
-- `private` schemas are read (public.members, auth.users), never altered.
--
-- This is the consolidated equivalent of the old migrations 001-016 (final state). Differences:
--   * public.user_roles is not recreated (replaced by admin_members since Fase 5).
--   * form_responses.files holds R2 object keys instead of public URLs.
--   * is_admin() also requires an ACTIVE PI-CORE member row for the caller.
--   * The legacy oprec tables (submissions, recruitments, selection_results) are copied in during
--     the data move (their structure comes from the production dump), not created here.
-- =============================================================================================

create schema if not exists form;

-- Nothing in `form` is reachable unless granted below.
revoke all on schema form from public;
grant usage on schema form to anon, authenticated, service_role;

alter default privileges in schema form revoke all on tables    from public, anon, authenticated;
alter default privileges in schema form revoke all on sequences from public, anon, authenticated;
alter default privileges in schema form revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------------------------
create or replace function form.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- admin_members: invite-only allowlist (unchanged model from old migration 009)
-- ---------------------------------------------------------------------------------------------
create table form.admin_members (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (email = lower(email)),
  role          text not null default 'super_admin' check (role in ('super_admin', 'divisi_admin')),
  status        text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  user_id       uuid references auth.users (id) on delete set null,
  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index idx_admin_members_email on form.admin_members (email);
create unique index idx_admin_members_user_id on form.admin_members (user_id) where user_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------------------------

-- TRUE when the caller has an ACTIVE admin_members row AND is an active PI-CORE member.
-- SECURITY DEFINER so RLS policies can call it without recursion; reads only rows about the caller.
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
  );
$$;
comment on function form.is_admin() is
  'TRUE if the caller has an active form.admin_members row and an active PI-CORE member row.';

-- The caller's own PI-CORE state, so the app can explain WHY someone is not let in
-- (no member row, deactivated, or still on a temporary password). Caller only, no other rows.
create or replace function form.my_picore_status()
returns table (has_member boolean, is_active boolean, must_change_password boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select
    m.id is not null,
    coalesce(m.is_active, false),
    coalesce(m.must_change_password, false)
  from (select 1) as one
  left join public.members m on m.user_id = (select auth.uid());
$$;

-- Link auth.uid() to the admin_members row with the caller's VERIFIED email (old migration 009).
-- No parameters: the app can never choose which row gets linked.
create or replace function form.link_admin_user_id()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_row form.admin_members;
begin
  if v_uid is null then
    return;
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return;
  end if;

  select * into v_row from form.admin_members where email = lower(v_email);
  if not found then
    return;
  end if;

  if v_row.user_id is null or v_row.user_id = v_uid then
    update form.admin_members
    set user_id = v_uid,
        last_login_at = now(),
        status = case when v_row.status = 'invited' then 'active' else v_row.status end
    where id = v_row.id
      and v_row.status in ('invited', 'active');
  end if;
end;
$$;

-- For the invite screen: does an ACTIVE PI-CORE member with this email have a login? Form admins
-- only (others get NULL), and it answers yes/no only, no other member data.
create or replace function form.picore_account_exists(p_email text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when not form.is_admin() then null
    else exists (
      select 1 from public.members m
      where m.email = lower(btrim(p_email)) and m.user_id is not null and m.is_active
    )
  end;
$$;

revoke all on function form.is_admin(), form.my_picore_status(), form.link_admin_user_id(),
  form.picore_account_exists(text) from public, anon;
grant execute on function form.is_admin(), form.my_picore_status(), form.link_admin_user_id(),
  form.picore_account_exists(text) to authenticated;
grant execute on function form.is_admin() to service_role;

alter table form.admin_members enable row level security;
create policy "Admins can manage admin_members" on form.admin_members
  for all to authenticated using (form.is_admin()) with check (form.is_admin());
create policy "Users can view own admin_members row" on form.admin_members
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------------------------
create table form.forms (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  slug          text not null unique,
  form_type     text not null default 'general'
                check (form_type in ('recruitment', 'event', 'survey', 'presensi', 'general')),
  is_open       boolean default true,
  open_date     timestamptz not null,
  close_date    timestamptz not null,
  form_fields   jsonb default '[]'::jsonb,
  settings      jsonb default '{}'::jsonb,
  sheets_config jsonb,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  is_deleted    boolean not null default false,
  deleted_at    timestamptz
);
comment on column form.forms.sheets_config is
  'Google Sheets mirror config {spreadsheet_id, sheet_name, enabled}. NULL = no Sheets integration.';

create index idx_forms_form_type  on form.forms (form_type);
create index idx_forms_created_by on form.forms (created_by);
create index idx_forms_active     on form.forms (created_at desc) where is_deleted = false;
create index idx_forms_deleted    on form.forms (deleted_at desc) where is_deleted = true;

create trigger handle_forms_updated_at before update on form.forms
  for each row execute function form.handle_updated_at();

alter table form.forms enable row level security;
create policy "Public can view open forms" on form.forms
  for select using (is_open = true);
create policy "Admins can view all forms" on form.forms
  for select to authenticated using (form.is_admin());
create policy "Admins can insert forms" on form.forms
  for insert to authenticated with check (form.is_admin());
create policy "Admins can update forms" on form.forms
  for update to authenticated using (form.is_admin()) with check (form.is_admin());
create policy "Admins can delete forms" on form.forms
  for delete to authenticated using (form.is_admin());

-- Visitors never see who created a form or where it mirrors to (old migration 014).
grant select (id, title, description, slug, form_type, is_open, open_date, close_date, form_fields,
              settings, created_at, updated_at, is_deleted, deleted_at)
  on form.forms to anon;
grant select, insert, update, delete on form.forms to authenticated;

-- ---------------------------------------------------------------------------------------------
-- form_responses
-- ---------------------------------------------------------------------------------------------
create table form.form_responses (
  id             uuid primary key default gen_random_uuid(),
  form_id        uuid not null references form.forms (id) on delete cascade,
  answers        jsonb default '{}'::jsonb,
  files          jsonb default '[]'::jsonb,
  respondent_id  uuid references auth.users (id) on delete set null,
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  nim_normalized text,
  status         text check (status is null or status in ('diterima', 'tidak_lolos', 'cadangan'))
);
comment on column form.form_responses.files is
  'Array of R2 object keys (form-attachments/<form_id>/...). Never public URLs.';

create index idx_form_responses_form_id        on form.form_responses (form_id);
create index idx_form_responses_submitted_at   on form.form_responses (submitted_at desc);
create index idx_form_responses_form_submitted on form.form_responses (form_id, submitted_at desc);
create index idx_form_responses_status         on form.form_responses (form_id, status) where status is not null;
create unique index idx_form_responses_nim_normalized
  on form.form_responses (form_id, nim_normalized) where nim_normalized is not null;

create trigger handle_form_responses_updated_at before update on form.form_responses
  for each row execute function form.handle_updated_at();

-- No INSERT policy: public submissions go through the server action with the service role.
alter table form.form_responses enable row level security;
create policy "Admins can view form responses" on form.form_responses
  for select to authenticated using (form.is_admin());
create policy "Admins can update response status" on form.form_responses
  for update to authenticated using (form.is_admin()) with check (form.is_admin());
create policy "Admins can delete form responses" on form.form_responses
  for delete to authenticated using (form.is_admin());

grant select, update, delete on form.form_responses to authenticated;

-- ---------------------------------------------------------------------------------------------
-- sheets_outbox (old migration 010)
-- ---------------------------------------------------------------------------------------------
create table form.sheets_outbox (
  response_id     uuid primary key references form.form_responses (id) on delete cascade,
  form_id         uuid not null references form.forms (id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'synced', 'failed')),
  attempts        int not null default 0,
  next_attempt_at timestamptz,
  last_error      text,
  synced_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_sheets_outbox_pending on form.sheets_outbox (form_id, next_attempt_at)
  where status in ('pending', 'failed');
create index idx_sheets_outbox_status on form.sheets_outbox (form_id, status);

alter table form.sheets_outbox enable row level security;
create policy "Admins can manage sheets_outbox" on form.sheets_outbox
  for all to authenticated using (form.is_admin()) with check (form.is_admin());

grant select, insert, update, delete on form.sheets_outbox to authenticated;

-- ---------------------------------------------------------------------------------------------
-- admin_audit_log: append-only (old migrations 009 + 012)
-- ---------------------------------------------------------------------------------------------
create table form.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email   text,
  action        text not null check (action in (
    'invite', 'reinvite', 'update_role', 'activate', 'disable', 'delete', 'self_link',
    'form_create', 'form_update', 'form_delete', 'form_duplicate', 'form_toggle',
    'response_delete', 'response_status_update',
    'sheets_config_save'
  )),
  target_email  text,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index idx_admin_audit_log_created_at on form.admin_audit_log (created_at desc);

alter table form.admin_audit_log enable row level security;
create policy "Admins can insert audit log" on form.admin_audit_log
  for insert to authenticated with check (form.is_admin());
create policy "Admins can view audit log" on form.admin_audit_log
  for select to authenticated using (form.is_admin());

grant select, insert on form.admin_audit_log to authenticated;
grant select, insert, update, delete on form.admin_members to authenticated;

-- The server (service role) does submissions, Sheets sync and the cron job.
grant all on all tables in schema form to service_role;
