-- Access tests for schema `form` (LOCAL stack only; everything is rolled back).
-- Run: docker exec -i supabase_db_pmk-form psql -U postgres -X -q -v ON_ERROR_STOP=1 < supabase/tests/form_access.test.sql
begin;

create function pg_temp.as_user(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not p_ok then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok   %', p_label;
end $$;

-- 1. Active admin with active member row
select pg_temp.as_user('admin@form.test');
select pg_temp.check(form.is_admin(), 'active admin is admin');
select pg_temp.check((select count(*) from form.forms) = 1, 'admin sees all forms');
select pg_temp.check((select count(*) from form.admin_members) = 5, 'admin sees all admin rows');
select pg_temp.check(form.picore_account_exists('member@form.test'), 'account check: active member with login = true');
select pg_temp.check(not form.picore_account_exists('inactive@form.test'), 'account check: deactivated member = false');
select pg_temp.check(not form.picore_account_exists('nobody@form.test'), 'account check: unknown email = false');
reset role;

-- 2. Invited: not admin until linked, then admin
select pg_temp.as_user('invited@form.test');
select pg_temp.check(not form.is_admin(), 'invited is not admin before linking');
select form.link_admin_user_id();
select pg_temp.check(form.is_admin(), 'invited becomes admin after link_admin_user_id');
reset role;

-- 3. Temporary password: linkable, status reports must_change_password
select pg_temp.as_user('temppw@form.test');
select pg_temp.check((select must_change_password from form.my_picore_status()), 'temppw reports must_change_password');
reset role;

-- 4. Deactivated PI-CORE member: active admin row but NOT admin
select pg_temp.as_user('inactive@form.test');
select pg_temp.check(not form.is_admin(), 'deactivated member is not admin');
select pg_temp.check((select count(*) from form.admin_members) = 1, 'deactivated member sees only own admin row');
select pg_temp.check((select not is_active from form.my_picore_status()), 'status reports inactive');
reset role;

-- 5. Disabled admin row: not admin, link does not re-enable
select pg_temp.as_user('disabled@form.test');
select form.link_admin_user_id();
select pg_temp.check(not form.is_admin(), 'disabled admin stays not admin after link');
reset role;

-- 6. Member without invite
select pg_temp.as_user('member@form.test');
select form.link_admin_user_id();
select pg_temp.check(not form.is_admin(), 'uninvited member is not admin');
select pg_temp.check((select count(*) from form.form_responses) = 0, 'non-admin sees no responses');
select pg_temp.check(form.picore_account_exists('admin@form.test') is null, 'account check: non-admin gets NULL');
do $$ begin
  insert into form.forms (title, slug, open_date, close_date) values ('x', 'x', now(), now());
  raise exception 'FAIL: non-admin inserted a form';
exception when insufficient_privilege then raise notice 'ok   non-admin cannot insert forms';
end $$;
do $$ begin
  insert into form.admin_members (email) values ('evil@form.test');
  raise exception 'FAIL: non-admin invited someone';
exception when insufficient_privilege then raise notice 'ok   non-admin cannot invite admins';
end $$;
reset role;

-- 7. Anonymous visitor
set local role anon;
select pg_temp.check((select count(*) from form.forms) = 1, 'anon sees the open form');
do $$ begin
  perform created_by from form.forms;
  raise exception 'FAIL: anon read created_by';
exception when insufficient_privilege then raise notice 'ok   anon cannot read created_by/sheets_config';
end $$;
do $$ begin
  perform 1 from form.form_responses;
  raise exception 'FAIL: anon read responses';
exception when insufficient_privilege then raise notice 'ok   anon cannot read responses';
end $$;
do $$ begin
  perform form.is_admin();
  raise exception 'FAIL: anon called is_admin';
exception when insufficient_privilege then raise notice 'ok   anon cannot call form functions';
end $$;
reset role;

-- 8. PI-CORE tables untouched by form roles: members still only own row for a regular member
select pg_temp.as_user('member@form.test');
select pg_temp.check((select count(*) from public.members) = 1, 'PI-CORE RLS unchanged: member sees own row only');
reset role;

-- 9. Admin through PI-CORE > Integrasi (app `form`, role `admin`), next to the invite list
select pg_temp.as_user('member@form.test');
select pg_temp.check(not form.is_admin(), 'member without invite or rule is not admin');
reset role;
insert into public.app_access_rules (app_key, app_role_key, subject_type, member_id, note)
select 'form', 'admin', 'member', m.id, 'test' from public.members m where m.email in ('member@form.test', 'temppw@form.test');
select pg_temp.as_user('member@form.test');
select pg_temp.check(form.is_admin(), 'PI-CORE rule makes a member admin without an invite');
select pg_temp.check((select count(*) from form.forms) = 1, 'rule admin sees all forms');
reset role;
select pg_temp.as_user('temppw@form.test');
select pg_temp.check(not form.is_admin(), 'PI-CORE rule does not help a temporary password');
reset role;
update public.app_access_rules set is_enabled = false where app_key = 'form' and note = 'test';
select pg_temp.as_user('member@form.test');
select pg_temp.check(not form.is_admin(), 'disabled PI-CORE rule gives nothing');
reset role;

rollback;
