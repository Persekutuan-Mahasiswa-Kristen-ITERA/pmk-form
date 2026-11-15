-- =============================================================================================
-- LOCAL ONLY. FAKE accounts for the pmk-form local Supabase stack.
-- NEVER run this against the hosted (shared) project: it writes into PI-CORE tables
-- (auth.users, auth.identities, public.members, public.periods).
--
-- Refuses to run unless the session sets form.allow_local_seed = 'yes' (scripts/dev-db.sh does),
-- and refuses again if ANY account or member email is outside @form.test (so it can only ever run on
-- a throwaway database). Safe to run more than once. Password for every account: FormLocal2026
-- =============================================================================================
\set ON_ERROR_STOP on

do $$
begin
  if coalesce(current_setting('form.allow_local_seed', true), '') <> 'yes' then
    raise exception 'seed_test_accounts.sql writes FAKE accounts into PI-CORE tables: local throwaway database only. Set form.allow_local_seed=yes (see scripts/dev-db.sh).';
  end if;
  if exists (select 1 from auth.users u where u.email is null or u.email !~* '@form\.test$')
     or exists (select 1 from public.members m where m.email !~* '@form\.test$') then
    raise exception 'seed_test_accounts.sql: found a non-test email address, so this is NOT a throwaway local database. Nothing was written.';
  end if;
end
$$;

insert into public.periods (label, starts_on, ends_on)
select '2026/2027', date '2026-08-01', date '2027-07-31'
where not exists (select 1 from public.periods where label = '2026/2027');

create temp table _persona (
  n            int primary key,
  email        text not null,
  full_name    text not null,
  must_change  boolean not null,
  deactivate   boolean not null,
  admin_status text,          -- form.admin_members.status, NULL = not invited
  pre_linked   boolean not null -- admin row already linked to the account (as after a first login)
) on commit drop;

insert into _persona values
  (1, 'admin@form.test',     'Admin Form Aktif',          false, false, 'active',   true),
  (2, 'invited@form.test',   'Calon Admin Diundang',      false, false, 'invited',  false),
  (3, 'temppw@form.test',    'Admin Sandi Sementara',     true,  false, 'invited',  false),
  (4, 'inactive@form.test',  'Admin Anggota Nonaktif',    false, true,  'active',   true),
  (5, 'disabled@form.test',  'Admin Dinonaktifkan',       false, false, 'disabled', true),
  (6, 'member@form.test',    'Anggota Bukan Admin',       false, false, null,       false);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  ('f1000000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated', p.email,
  extensions.crypt('FormLocal2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', ''
from _persona p
where not exists (select 1 from auth.users u where u.email = p.email);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from _persona p
join auth.users u on u.email = p.email
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.members (id, user_id, full_name, email, must_change_password)
select ('f2000000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid, u.id, p.full_name, p.email, p.must_change
from _persona p
join auth.users u on u.email = p.email
where not exists (select 1 from public.members m where m.email = p.email);

update public.members m set is_active = false
from _persona p
where m.email = p.email and p.deactivate and m.is_active;

insert into form.admin_members (email, status, user_id)
select p.email, p.admin_status, case when p.pre_linked then u.id end
from _persona p
join auth.users u on u.email = p.email
where p.admin_status is not null
on conflict (email) do nothing;

-- One open sample form with a file field, so uploads can be tried end to end.
insert into form.forms (title, description, slug, form_type, is_open, open_date, close_date, form_fields, settings)
select 'Form Uji Lokal', 'Form contoh untuk stack lokal.', 'form-uji-lokal', 'general', true,
       now() - interval '1 day', now() + interval '30 days',
       '[{"id":"f_nama","type":"short_text","label":"Nama","required":true},
         {"id":"f_berkas","type":"file_upload","label":"Berkas","required":false}]'::jsonb,
       '{}'::jsonb
where not exists (select 1 from form.forms where slug = 'form-uji-lokal');
