-- SQL script untuk import hasil seleksi Staff Internship PMK 2026
-- Jalankan di Supabase SQL Editor

-- 1. Create table jika belum ada
create table if not exists public.selection_results (
  id uuid default uuid_generate_v4() primary key,
  recruitment_slug text not null default 'staff-internship-2026',
  nim text not null,
  nama text not null,
  prodi text,
  departemen text not null,
  divisi text not null,
  status text not null default 'ACCEPTED',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Create indexes
create index if not exists idx_selection_results_nim on public.selection_results (nim);
create index if not exists idx_selection_results_recruitment_slug on public.selection_results (recruitment_slug);

-- 3. Enable RLS
alter table public.selection_results enable row level security;

-- 4. RLS Policies
drop policy if exists "Public can view own result" on public.selection_results;
drop policy if exists "Admins can manage selection results" on public.selection_results;

-- Policy: Publik hanya bisa SELECT berdasarkan NIM yang cocok dengan submissions mereka (via API, not direct)
-- Untuk sekarang, hanya admin yang bisa SELECT
create policy "Admins can manage selection results"
  on public.selection_results for all
  to authenticated
  using (true)
  with check (true);

-- 5. Insert 53 records hasil seleksi (file sudah diperbaiki)
insert into public.selection_results (nim, nama, prodi, departemen, divisi, recruitment_slug, status)
values
('126180015', 'Ruth melati gresia Pasaribu', 'Biologi', 'Biro Kewirausahaan', 'Unknown', 'staff-internship-2026', 'ACCEPTED'),
('126120102', 'Christian Moses Wijaya', 'Teknik Geofisika', 'Departemen Internal', 'Divisi Event Organizer', 'staff-internship-2026', 'ACCEPTED'),
('126150117', 'Moreno Valentino', 'Teknik Geologi', 'Departemen Pelayanan Khusus', 'Divisi Worship', 'staff-internship-2026', 'ACCEPTED'),
('126140086', 'Magen Sudan Mangisara Tambunan', 'Teknik Informatika', 'Departemen CMIT', 'Divisi IT', 'staff-internship-2026', 'ACCEPTED'),
('126190060', 'Sidabukke Anggelica', 'Teknik Industri', 'Biro Kewirausahaan', 'Unknown', 'staff-internship-2026', 'ACCEPTED'),
('126220018', 'Zefanya Septiani', 'Perencanaan Wilayah dan Tata Kota', 'Departemen Internal', 'Divisi Event Organizer', 'staff-internship-2026', 'ACCEPTED'),
('126410125', 'Novelia Elisabeth Sitompul', 'Sains Aktuaria', 'Departemen Pelayanan Khusus', 'Divisi Worship', 'staff-internship-2026', 'ACCEPTED'),
('126370021', 'Leon Irwan Sinaga', 'Teknik Pertambangan', 'Departemen CMIT', 'Divisi IT', 'staff-internship-2026', 'ACCEPTED'),
('126150069', 'Christella Monavae Natalita', 'Teknik Geologi', 'Biro Kewirausahaan', 'Unknown', 'staff-internship-2026', 'ACCEPTED'),
('126430007', 'Keizya Dwi Aryani Telaumbanua', 'Teknik Biomedis', 'Departemen Internal', 'Divisi Event Organizer', 'staff-internship-2026', 'ACCEPTED'),
('126410084', 'Ezra Elizabeth Manondang Panjaitan', 'Sains Aktuaria', 'Departemen Pelayanan Khusus', 'Divisi Worship', 'staff-internship-2026', 'ACCEPTED'),
('126120027', 'Grace Naomi R', 'Teknik Geofisika', 'Departemen CMIT', 'Divisi IT', 'staff-internship-2026', 'ACCEPTED'),
('126260113', 'Yeremia Siringoringo', 'farmasi', 'Biro Kewirausahaan', 'Unknown', 'staff-internship-2026', 'ACCEPTED'),
('126210123', 'Relita Iishabela Sitompul', 'Teknik sipil', 'Departemen Pelayanan Khusus', 'Divisi Worship', 'staff-internship-2026', 'ACCEPTED'),
('126280043', 'Chantika Putri Tabitha Hutahaean', 'Teknik Kimia', 'Departemen Internal', 'Divisi Harmonisasi', 'staff-internship-2026', 'ACCEPTED'),
('126140078', 'ARIEL JOHN HOWARD SITANGGANG', 'Teknik Informatika', 'Departemen CMIT', 'Divisi  Publikasi dan Dokumentasi', 'staff-internship-2026', 'ACCEPTED'),
('126250151', 'Renata Sanjani Lubis', 'Teknik Lingkungan', 'Departemen Internal', 'Divisi Harmonisasi', 'staff-internship-2026', 'ACCEPTED'),
('126250090', 'Greace Perbina Pepayosa Br Perangin Angin', 'Teknik Lingkungan', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', 'staff-internship-2026', 'ACCEPTED'),
('126280042', 'Yrene Gresilia Silalahi', 'Teknik Kimia', 'Departemen Internal', 'Divisi Harmonisasi', 'staff-internship-2026', 'ACCEPTED'),
('126430005', 'Nelvina Telaumbanua', 'Teknik Biomedis', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', 'staff-internship-2026', 'ACCEPTED'),
('126360105', 'Syelomitha', 'Teknik Material', 'Departemen CMIT', 'Divisi  Publikasi dan Dokumentasi', 'staff-internship-2026', 'ACCEPTED'),
('126220196', 'Anatasya Daeli', 'Perencanaan Wilayah dan Kota', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', 'staff-internship-2026', 'ACCEPTED'),
('126250072', 'Anita Sintia Purba', 'Teknik Lingkungan', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', 'staff-internship-2026', 'ACCEPTED'),
('126120155', 'Jemima Abigail Siagian', 'Teknik Geofisika', 'Departemen CMIT', 'Divisi Desain', 'staff-internship-2026', 'ACCEPTED'),
('126500058', 'Tio Vanesa Celia Wala', 'Rekayasa kosmetik', 'Departemen CMIT', 'Divisi Desain', 'staff-internship-2026', 'ACCEPTED'),
('126120173', 'Jonathan Simanjuntak', 'Teknik Geofisika', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'staff-internship-2026', 'ACCEPTED'),
('126380108', 'Alice Tamaris Sean Sharon Malau', 'Desain Komunikasi Visual', 'Departemen CMIT', 'Divisi Desain', 'staff-internship-2026', 'ACCEPTED'),
('126190182', 'vita yuliani sinaga', 'Teknik Industri', 'Departemen Eksternal', 'Divisi Intra Kampus', 'staff-internship-2026', 'ACCEPTED'),
('126220084', 'Samuel Marchelino Sitepu', 'Perencanaan Wilayah dan Kota', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'staff-internship-2026', 'ACCEPTED'),
('126160064', 'Dina Naftauli Tambunan', 'Matematika', 'Departemen Eksternal', 'Divisi Intra Kampus', 'staff-internship-2026', 'ACCEPTED'),
('126150101', 'Alfa Gideon Sinaga', 'Teknik Geologi', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'staff-internship-2026', 'ACCEPTED'),
('126410121', 'Praja Estomihi Marthumbur Aritonang', 'Sains Aktuaria', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'staff-internship-2026', 'ACCEPTED'),
('126270021', 'Bagas Ambarita', 'Kimia', 'Departemen Eksternal', 'Divisi Ekstra Kampus', 'staff-internship-2026', 'ACCEPTED'),
('126310034', 'Ryan Galathy Pakpahan', 'Teknik Biosistem', 'Departemen Operasional', 'Divisi Akomodasi', 'staff-internship-2026', 'ACCEPTED'),
('126190196', 'IVAN SASMITRO SIMAMORA', 'Teknik Industri', 'Departemen Eksternal', 'Divisi Ekstra Kampus', 'staff-internship-2026', 'ACCEPTED'),
('126120171', 'Nathanael Alesandro Tindaon', 'Teknik Geofisika', 'Departemen Operasional', 'Divisi Akomodasi', 'staff-internship-2026', 'ACCEPTED'),
('126410056', 'Louis Givin Hadinata Ginting', 'Sains Aktuaria', 'Departemen Operasional', 'Divisi Akomodasi', 'staff-internship-2026', 'ACCEPTED'),
('126480045', 'Elgama Lawrensius Sihombing', 'Rekayasa minyak dan gas', 'Departemen Talenta', 'Divisi Extra Youth', 'staff-internship-2026', 'ACCEPTED'),
('126120204', 'HANNA JOJOR NAPITUPULU', 'TEKNIK GEOFISIKA', 'Departemen Operasional', 'Divisi Akomodasi', 'staff-internship-2026', 'ACCEPTED'),
('126350014', 'Sela Agustina Simarmata', 'Teknologi pangan', 'Departemen Talenta', 'Divisi Extra Youth', 'staff-internship-2026', 'ACCEPTED'),
('126270026', 'Chelsea Olivia Hutabarat', 'Kimia', 'Departemen Talenta', 'Divisi Extra Youth', 'staff-internship-2026', 'ACCEPTED'),
('126210018', 'Juan Carlos Antonio Manurung', 'Teknik Sipil', 'Departemen Operasional', 'Divisi Logistik', 'staff-internship-2026', 'ACCEPTED'),
('126330133', 'Jonathan Simanjuntak', 'Teknologi Industri Pertanian', 'Departemen Operasional', 'Divisi Logistik', 'staff-internship-2026', 'ACCEPTED'),
('126360069', 'Gamaliel Glen Sinaga', 'Teknik Material', 'Departemen Pembinaan Rohani', 'Divisi Doa dan Pemerhati', 'staff-internship-2026', 'ACCEPTED'),
('126430142', 'Lim Ing Nababan', 'Teknik Biomedis', 'Departemen Talenta', 'Divisi Art Interest', 'staff-internship-2026', 'ACCEPTED'),
('126400022', 'Alva Imanuel Pasaribu', 'Teknik Telekomunikasi', 'Departemen Operasional', 'Divisi Logistik', 'staff-internship-2026', 'ACCEPTED'),
('126490006', 'Aprilina Sinaga', 'Rekayasa Instrumentasi dan Automasi', 'Departemen Pembinaan Rohani', 'Divisi Doa dan Pemerhati', 'staff-internship-2026', 'ACCEPTED'),
('126410015', 'Aurel Kristin Sihombing', 'Sains Aktuaria', 'Departemen Operasional', 'Divisi Logistik', 'staff-internship-2026', 'ACCEPTED'),
('126250134', 'Ririn Setiani Tanjung', 'Teknik Lingkungan', 'Departemen Pembinaan Rohani', 'Divisi Doa dan Pemerhati', 'staff-internship-2026', 'ACCEPTED'),
('126190180', 'Vidya Miracle Natalie S', 'Teknik Industri', 'Departemen Talenta', 'Divisi Art Interest', 'staff-internship-2026', 'ACCEPTED'),
('126260002', 'Gerald Christian Hasudungan Samosir', 'Farmasi', 'Departemen Pembinaan Rohani', 'Divisi Gospel Group', 'staff-internship-2026', 'ACCEPTED'),
('126240031', 'Winsan Tri Turnip', 'Arsitektur', 'Departemen Pembinaan Rohani', 'Divisi Gospel Group', 'staff-internship-2026', 'ACCEPTED'),
('126340089', 'Natanael Even Bangun', 'Teknik Sistem Energi', 'Departemen Talenta', 'Divisi Art Interest', 'staff-internship-2026', 'ACCEPTED')
on conflict do nothing;

-- 6. Verify insert
select count(*) as total_inserted from public.selection_results where recruitment_slug = 'staff-internship-2026';
