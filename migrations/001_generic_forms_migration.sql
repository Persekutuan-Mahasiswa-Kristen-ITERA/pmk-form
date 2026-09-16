-- ==========================================
-- MIGRASI 001: Transformasi ke Platform Form Generik
-- Dari: recruitments + submissions
-- Ke: forms + form_responses + user_roles
-- ==========================================

-- 1. Enable extensions
create extension if not exists "uuid-ossp";

-- ==========================================
-- 2. TABEL BARU: user_roles (role berjenjang)
-- ==========================================
create table public.user_roles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  role text not null check (role in ('super_admin', 'divisi_admin')),
  division text, -- misal: 'Humas', 'Acara', 'Internal', 'Pelayanan'
  created_at timestamptz default now() not null
);

-- RLS user_roles
alter table public.user_roles enable row level security;

-- Super admin bisa kelola semua role
create policy "Super admin can manage all roles"
  on public.user_roles for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'super_admin'
    )
  );

-- User bisa baca role sendiri
create policy "User can view own role"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

-- ==========================================
-- 3. TABEL BARU: forms (generalisasi recruitments)
-- ==========================================
create table public.forms (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  slug text not null unique,
  form_type text not null default 'general' check (form_type in ('recruitment', 'event', 'survey', 'presensi', 'general')),
  is_open boolean default true,
  open_date timestamptz not null,
  close_date timestamptz not null,
  form_fields jsonb default '[]'::jsonb, -- Array of FieldConfig dengan id stabil
  settings jsonb default '{}'::jsonb,    -- { allowed_angkatan: [], wa_group_link: "", collect_identity: true, max_responses: null }
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes
create index idx_forms_slug on public.forms(slug);
create index idx_forms_form_type on public.forms(form_type);
create index idx_forms_created_by on public.forms(created_by);

-- ==========================================
-- 4. TABEL BARU: form_responses (generalisasi submissions)
-- ==========================================
create table public.form_responses (
  id uuid default uuid_generate_v4() primary key,
  form_id uuid not null references public.forms(id) on delete cascade,
  answers jsonb default '{}'::jsonb,      -- Semua jawaban termasuk identitas: { "field_name": "value", "field_nim": "121140001" }
  files jsonb default '[]'::jsonb,        -- Array URL file: ["https://...", "https://..."]
  respondent_id uuid references auth.users(id) on delete set null,
  submitted_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes
create index idx_form_responses_form_id on public.form_responses(form_id);
create index idx_form_responses_submitted_at on public.form_responses(submitted_at desc);

-- ==========================================
-- 5. TABEL EXISTING: selection_results (tambahkan trigger updated_at)
-- ==========================================
-- Cek apakah tabel ada, jika ada tambahkan trigger
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'selection_results') then
    -- Tambah kolom updated_at jika belum ada
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'selection_results' and column_name = 'updated_at') then
      alter table public.selection_results add column updated_at timestamptz default now();
    end if;
    -- Trigger updated_at
    create trigger handle_selection_results_updated_at
      before update on public.selection_results
      for each row execute procedure public.handle_updated_at();
  end if;
end $$;

-- ==========================================
-- 6. UPDATED_AT TRIGGER (reuse existing function)
-- ==========================================
-- Function sudah ada dari schema lama, tapi pastikan:
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger untuk forms
create trigger handle_forms_updated_at
  before update on public.forms
  for each row execute procedure public.handle_updated_at();

-- Trigger untuk form_responses
create trigger handle_form_responses_updated_at
  before update on public.form_responses
  for each row execute procedure public.handle_updated_at();

-- ==========================================
-- 7. RLS POLICIES: forms
-- ==========================================
alter table public.forms enable row level security;

-- Publik bisa lihat form yang buka
create policy "Public can view open forms"
  on public.forms for select
  using (is_open = true);

-- Admin bisa lihat semua form
create policy "Admins can view all forms"
  on public.forms for select
  to authenticated
  using (true);

-- Admin bisa insert form
create policy "Admins can insert forms"
  on public.forms for insert
  to authenticated
  with check (true);

-- Admin bisa update form (super_admin atau creator/divisi_admin yang cocok)
create policy "Admins can update forms"
  on public.forms for update
  to authenticated
  using (true)
  with check (true);

-- Admin bisa delete form
create policy "Admins can delete forms"
  on public.forms for delete
  to authenticated
  using (true);

-- ==========================================
-- 8. RLS POLICIES: form_responses
-- ==========================================
alter table public.form_responses enable row level security;

-- Publik (anon + authenticated) bisa submit response
create policy "Anyone can submit form responses"
  on public.form_responses for insert
  to anon, authenticated
  with check (true);

-- Admin bisa lihat responses (dengan filter berdasarkan role nanti di application layer)
create policy "Admins can view form responses"
  on public.form_responses for select
  to authenticated
  using (true);

-- Admin bisa delete responses
create policy "Admins can delete form responses"
  on public.form_responses for delete
  to authenticated
  using (true);

-- ==========================================
-- 9. STORAGE: Bucket form-attachments (generik)
-- ==========================================
insert into storage.buckets (id, name, public)
values ('form-attachments', 'form-attachments', true)
on conflict (id) do nothing;

-- RLS storage.objects (sudah enable dari schema lama, tapi pastikan policy untuk bucket baru)
-- Allow public (anon) and authenticated to upload files to form-attachments
create policy "Anyone can upload files to form-attachments"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'form-attachments' AND
    (storage.extension(name) in ('pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'))
  );

-- Allow anyone to view files from form-attachments
create policy "Anyone can view files from form-attachments"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'form-attachments');

-- Admins can delete files from form-attachments
create policy "Admins can delete files from form-attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'form-attachments');

create policy "Admins can update files from form-attachments"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'form-attachments');

-- ==========================================
-- 10. MIGRASI DATA: recruitments -> forms
-- ==========================================
-- Cek apakah tabel lama ada
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recruitments') then
    
    -- Insert ke forms dengan mapping kolom
    insert into public.forms (
      id, title, description, slug, form_type, is_open,
      open_date, close_date, form_fields, settings,
      created_by, created_at, updated_at
    )
    select
      id,
      title,
      description,
      slug,
      'recruitment'::text as form_type,
      is_open,
      open_date,
      close_date,
      -- Tambahkan id stabil ke form_fields jika belum ada
      case
        when jsonb_typeof(form_fields) = 'array' then
          (
            select jsonb_agg(
              case
                when jsonb_typeof(elem) = 'object' and elem ? 'id' then elem
                else jsonb_set(elem, '{id}', to_jsonb('field_' || (row_number() over ())::text))
              end
            )
            from jsonb_array_elements(form_fields) as elem
          )
        else '[]'::jsonb
      end as form_fields,
      jsonb_build_object(
        'allowed_angkatan', coalesce(allowed_angkatan, '[]'::jsonb),
        'wa_group_link', coalesce(wa_group_link, ''),
        'collect_identity', true,
        'max_responses', null
      ) as settings,
      null as created_by, -- unknown creator
      created_at,
      updated_at
    from public.recruitments
    on conflict (id) do nothing;
    
    raise notice 'Migrated % rows from recruitments to forms', (select count(*) from public.recruitments);
  else
    raise notice 'Table recruitments does not exist, skipping data migration';
  end if;
end $$;

-- ==========================================
-- 11. MIGRASI DATA: submissions -> form_responses
-- ==========================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'submissions') then
    
    insert into public.form_responses (
      id, form_id, answers, files, submitted_at, updated_at
    )
    select
      s.id,
      s.recruitment_id as form_id,
      -- Gabungkan identitas + answers ke dalam answers jsonb
      jsonb_build_object(
        'field_applicant_name', s.applicant_name,
        'field_applicant_email', s.applicant_email,
        'field_applicant_nim', s.applicant_nim
      ) || coalesce(s.answers, '{}'::jsonb) as answers,
      coalesce(s.files, '[]'::jsonb) as files,
      s.submitted_at,
      s.updated_at
    from public.submissions s
    on conflict (id) do nothing;
    
    raise notice 'Migrated % rows from submissions to form_responses', (select count(*) from public.submissions);
  else
    raise notice 'Table submissions does not exist, skipping data migration';
  end if;
end $$;

-- ==========================================
-- 12. VERIFIKASI MIGRASI
-- ==========================================
-- Tampilkan ringkasan
select 'forms' as table_name, count(*) as rows from public.forms
union all
select 'form_responses', count(*) from public.form_responses
union all
select 'user_roles', count(*) from public.user_roles
union all
select 'selection_results', count(*) from public.selection_results
union all
select 'recruitments (old)', count(*) from public.recruitments
union all
select 'submissions (old)', count(*) from public.submissions;