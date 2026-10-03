-- ==========================================
-- MIGRASI 009: Model otorisasi allowlist (admin_members) + audit log
-- FASE 5-2 — JALANKAN SEBELUM DEPLOY KODE. SATU TRANSAKSI.
-- ==========================================
-- TUJUAN: ganti sumber kebenaran otorisasi dari public.user_roles ke
-- public.admin_members (invite-only, by EMAIL), tanpa menjatuhkan
-- user_roles (aturan: user_roles tidak boleh di-drop).
--
-- PRINSIP (Tambahan #3 dari user):
--   - SATU TRANSAKSI: semua atau tidak sama sekali. Jika seed gagal,
--     seluruh migration dibatalkan (rollback otomatis).
--   - RAISE EXCEPTION bila 0 admin aktif setelah seed -> deploy kode
--     TIDAK boleh terjadi tanpa admin (anti lockout).
--   - email disimpan lowercase: constraint CHECK + index unik di lower(email).
--   - REVOKE/GRANT is_admin() dipertahankan persis seperti 002.
--   - Rollback jujur di bawah, termasuk keterangannya.
--
-- URUTAN ROLLOUT (WAJIB, dari Tambahan #3): MIGRATION DULU, BARU DEPLOY KODE.
-- ==========================================

begin;

-- ==========================================
-- LANGKAH 1: Tabel admin_members
-- ==========================================
create table if not exists public.admin_members (
  id uuid primary key default gen_random_uuid(),
  -- Email lowercase unik. Normalisasi dilakukan DB (constraint di bawah)
  -- sehingga aplikasi tidak bisa menyelipkan email campuran huruf.
  email text not null,
  role text not null default 'super_admin'
    check (role in ('super_admin', 'divisi_admin')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'disabled')),
  -- Ditautkan saat login pertama oleh fungsi link_admin_user_id() (LANGKAH 3).
  -- Nullable karena undangan dibuat SEBELUM akun Google ada.
  user_id uuid references auth.users(id) on delete set null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Wajib lowercase + unik. Dua baris ini adalah jaminan tunggal: tidak ada
-- duplikat 'A@x.com' vs 'a@x.com'.
alter table public.admin_members
  add constraint admin_members_email_lowercase check (email = lower(email));
create unique index if not exists idx_admin_members_email
  on public.admin_members (email);

-- user_id unik jika tidak null (satu akun tidak bisa jadi 2 entri allowlist).
create unique index if not exists idx_admin_members_user_id
  on public.admin_members (user_id) where user_id is not null;

alter table public.admin_members enable row level security;

-- ==========================================
-- LANGKAH 2: is_admin() sekarang membaca admin_members
-- ==========================================
-- Nama + semantik tetap (ada baris aktif = admin), tapi sumbernya pindah ke
-- admin_members. Semua policy 003/007 yang memanggil public.is_admin()
-- langsung kompatibel TANPA perubahan policy.
-- Tetap SECURITY DEFINER + search_path dikunci (anti rekursi, anti hijack).
--
-- !!! DIDEFINISIKAN SEBELUM policy admin_members di LANGKAH 3 karena policy
-- !!! itu memanggil public.is_admin(). Di produksi is_admin() sudah ada
-- (!002), tapi migration harus benar berdiri sendiri.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.admin_members am
        where am.user_id = auth.uid()
          and am.status = 'active'
    );
$$;

comment on function public.is_admin() is
  'TRUE bila user saat ini punya baris AKTIF di public.admin_members. '
  'Sumber kebenaran sejak Fase 5 (sebelumnya user_roles). '
  'SECURITY DEFINER + set search_path agar bisa dipakai di RLS tanpa rekursi.';

-- REVOKE/GRANT dipertahankan PERSIS seperti migration 002.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ==========================================
-- LANGKAH 3: RLS admin_members
-- ==========================================
-- Policy ini TIDAK boleh self-referencing (hindari 42P17 seperti 002b):
-- memakai public.is_admin() yang SECURITY DEFINER (bypass RLS).
-- (Tambahan user: admin kelola semua; user boleh baca barisnya sendiri.)
drop policy if exists "Admins can manage admin_members" on public.admin_members;
create policy "Admins can manage admin_members"
  on public.admin_members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can view own admin_members row" on public.admin_members;
create policy "Users can view own admin_members row"
  on public.admin_members for select
  to authenticated
  using (user_id = auth.uid());

-- ==========================================
-- LANGKAH 4: Tabel admin_audit_log (APPEND-ONLY, Tambahan #4)
-- ==========================================
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null check (action in (
    'invite', 'reinvite', 'update_role', 'activate', 'disable', 'delete', 'self_link'
  )),
  target_email text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

-- INSERT hanya admin. SELECT hanya admin.
-- !!! SESUAI TAMBAHAN #4: TIDAK ADA policy UPDATE/DELETE -> tabel tidak bisa
-- diubah selain di-append, bahkan oleh admin, kecuali via service role.
drop policy if exists "Admins can insert audit log" on public.admin_audit_log;
create policy "Admins can insert audit log"
  on public.admin_audit_log for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can view audit log" on public.admin_audit_log;
create policy "Admins can view audit log"
  on public.admin_audit_log for select
  to authenticated
  using (public.is_admin());

-- ==========================================
-- LANGKAH 5: Fungsi link_admin_user_id() (Tambahan #2)
-- ==========================================
-- Penautan user_id dilakukan DI DATABASE lewat fungsi SECURITY DEFINER
-- TANPA PARAMETER. Email diambil dari auth.users by auth.uid() — BUKAN dari
-- payload client. Ini mencegah user menautkan user_id-nya ke baris email
-- lain (mis. akun Google A mencoba klaim invite milik email B).
--
-- Aturan ketat:
--   - email_confirmed_at harus NOT NULL (hanya email terverifikasi).
--   - hanya update baris dengan user_id IS NULL (undangan belum ditautkan)
--     ATAU user_id = auth.uid() (login ulang admin yang sudah ditautkan).
--   - status DISABLED TIDAK PERNAH bisa diaktifkan kembali lewat login
--     (klausa status = 'invited' atau 'active' hanya untuk update kolom
--      last_login_at/user_id; baris disabled tidak diubah).
--   - tidak ada parameter -> tidak bisa disalahgunakan dari client.
create or replace function public.link_admin_user_id()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.admin_members;
begin
  if v_uid is null then
    return;
  end if;

  select email into v_email
  from auth.users
  where id = v_uid and email_confirmed_at is not null;

  if v_email is null then
    return;  -- email belum terverifikasi: jangan tautkan apa pun
  end if;

  select * into v_row
  from public.admin_members
  where email = lower(v_email);

  if not found then
    return;  -- email tidak ada di allowlist: bukan admin, diam saja
  end if;

  -- Hanya jika belum ditautkan ATAU login ulang oleh pemilik baris yang sama.
  if v_row.user_id is null or v_row.user_id = v_uid then
    update public.admin_members
    set user_id = v_uid,
        last_login_at = now(),
        -- status invited -> active hanya di sini (transisi sah saat login).
        status = case when v_row.status = 'invited' then 'active' else v_row.status end
    where id = v_row.id
      -- Baris DISABLED tidak diaktifkan kembali lewat login:
      and v_row.status in ('invited', 'active');
  end if;
end;
$$;

comment on function public.link_admin_user_id() is
  'Tautkan auth.uid() ke baris admin_members berdasarkan email TERVERIFIKASI '
  'di auth.users. Tanpa parameter, SECURITY DEFINER. Hanya untuk user_id NULL '
  'atau pemilik baris. Baris disabled tidak diaktifkan ulang.';

revoke execute on function public.link_admin_user_id() from public, anon;
grant execute on function public.link_admin_user_id() to authenticated;

-- ==========================================
-- LANGKAH 6: Seed admin dari user_roles (Tambahan #3: tanpa input manual)
-- ==========================================
-- Memindahkan admin yang sudah ada (produksi: 1 baris super_admin
-- biroitpmkitera@gmail.com) ke allowlist baru, status active dan user_id
-- sudah terautkan (akun email/password sudah ada).
insert into public.admin_members (email, role, status, user_id, created_at)
select lower(u.email),
       ur.role,
       'active',
       ur.user_id,
       now()
from public.user_roles ur
join auth.users u on u.id = ur.user_id
on conflict (email) do update
  set role = excluded.role,
      status = 'active',
      user_id = excluded.user_id;

-- ==========================================
-- LANGKAH 7: Guard integritas — RAISE EXCEPTION bila 0 admin aktif
-- ==========================================
-- Anti-lockout: setelah migration ini commit, WAJIB minimal 1 admin aktif.
-- Jika tidak, seluruh transaksi dibatalkan (begin/commit = all-or-nothing).
do $$
declare
  active_count int;
begin
  select count(*) into active_count
  from public.admin_members
  where status = 'active';

  if active_count = 0 then
    raise exception
      'MIGRASI 009 GAGAL: 0 admin aktif di admin_members setelah seed. '
      'Deploy kode Fase 5 tidak boleh dilakukan tanpa admin aktif '
      '(semua halaman /admin/* akan terkunci). Periksa tabel user_roles dan '
      'auth.users, lalu jalankan ulang migration ini.';
  end if;

  raise notice 'SEED ADMIN OK: % admin aktif di admin_members.', active_count;
end
$$;

commit;

-- ==========================================
-- TEMPLATE SEED TAMBAHAN (opsional, dari 5.2 — GANTI EMAILNYA)
-- ==========================================
-- Undang admin lain tanpa menyentuh DB secara manual. Email harus lowercase
-- (constraint menolak huruf besar). Jalankan SETELAH migration ini, di luar
-- transaksi di atas:
--
--   insert into public.admin_members (email, role, status, invited_by)
--   values ('ganti@email.com', 'super_admin', 'invited',
--           (select id from auth.users where email = 'biroitpmkitera@gmail.com'));
--
-- Status 'invited' -> aktif otomatis saat login Google pertama kali
-- (fungsi link_admin_user_id()).

-- ==========================================
-- VERIFIKASI PASCA-MIGRATION (read-only, WAJIB sebelum deploy)
-- ==========================================
-- V1. Admin hasil seed (minimal 1 baris, status active):
--
--   select email, role, status, user_id from public.admin_members;
--
-- V2. is_admin() untuk user yang sudah login sebagai admin:
--     (jalankan sebagai user TERSEBUT di SQL Editor, bukan service role)
--
--   select public.is_admin();   -- harus true
--
-- V3. Fungsi penautan ada dan aman:
--
--   select proname from pg_proc where proname = 'link_admin_user_id';
--
-- V4. user_roles TIDAK terhapus (aturan):
--
--   select count(*) from public.user_roles;   -- harus tetap >= 1
--
-- V5. Policy audit log TIDAK punya UPDATE/DELETE (append-only):
--
--   select policyname, cmd from pg_policies
--   where tablename = 'admin_audit_log' order by cmd;
--   -- hanya INSERT dan SELECT. Jika ada UPDATE/DELETE -> bug, hapus policy itu.

-- ==========================================
-- ROLLBACK (JUJUR)
-- ==========================================
-- Rolldown migration ini HANYA mengembalikan is_admin() ke user_roles dan
-- menghapus objek baru. user_roles dan data di dalamnya TIDAK disentuh oleh
-- migration ini, jadi tidak ada data admin yang hilang dengan rollback.
--
-- PERHATIAN URUTAN (sama seperti 002/003): policy 003/007 memanggil
-- public.is_admin(). Jangan drop sesuatu yang membuat is_admin() hilang
-- sebelum is_admin() versi lama dipulihkan. Karena di sini kita hanya
-- MENGGANTI isi fungsi (bukan drop), rollback-nya langsung aman:
--
--   begin;
--   -- 1. Kembalikan is_admin() ke membaca user_roles (versi Fase 1):
--   create or replace function public.is_admin()
--   returns boolean language sql security definer stable set search_path = public as $$
--       select exists (
--           select 1 from public.user_roles ur
--           where ur.user_id = auth.uid()
--       );
--   $$;
--   revoke execute on function public.is_admin() from public, anon;
--   grant execute on function public.is_admin() to authenticated;
--
--   -- 2. Hapus objek Fase 5 (data admin_members terhapus — itu data baru,
--   --    tapi SEEDNYA berasal dari user_roles yang masih ada, jadi admin
--   --    tetap bisa login setelah rollback).
--   drop policy if exists "Admins can manage admin_members" on public.admin_members;
--   drop policy if exists "Users can view own admin_members row" on public.admin_members;
--   drop policy if exists "Admins can insert audit log" on public.admin_audit_log;
--   drop policy if exists "Admins can view audit log" on public.admin_audit_log;
--   drop function if exists public.link_admin_user_id();
--   drop table if exists public.admin_audit_log;
--   drop table if exists public.admin_members;
--   commit;
--
-- APA YANG TIDAK BISA DIPULIHKAN TANPA BACKUP:
--   - Baris admin_members yang dibuat MANUAL (invite departemen) setelah
--     migration akan hilang saat rollback. Catat daftar emailnya dulu
--     (select email from admin_members) sebelum rollback jika perlu.
--   - Baris admin_audit_log hilang (append-only log; dianggap dapat hilang).
-- ==========================================
