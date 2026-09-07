-- SQL script untuk import hasil seleksi Staff Internship PMK 2026 (WITH WhatsApp Group Links)
-- Jalankan di Supabase SQL Editor

-- 1. Drop table lama jika ada (untuk clean import)
drop table if exists public.selection_results cascade;

-- 2. Create table dengan kolom wa_group_link
create table public.selection_results (
  id uuid default uuid_generate_v4() primary key,
  recruitment_slug text not null default 'staff-internship-2026',
  nim text not null,
  nama text not null,
  prodi text,
  departemen text not null,
  divisi text not null,
  wa_group_link text,
  status text not null default 'ACCEPTED',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. Create indexes
create index idx_selection_results_nim on public.selection_results (nim);
create index idx_selection_results_recruitment_slug on public.selection_results (recruitment_slug);

-- 4. Enable RLS
alter table public.selection_results enable row level security;

-- 5. RLS Policies
create policy "Admins can manage selection results"
  on public.selection_results for all
  to authenticated
  using (true)
  with check (true);

-- 6. Insert 53 records hasil seleksi (dengan WhatsApp group link per departemen)
insert into public.selection_results (nim, nama, prodi, departemen, divisi, wa_group_link, recruitment_slug, status)
values
-- Biro Kewirausahaan
('126180015', 'Ruth melati gresia Pasaribu', 'Biologi', 'Biro Kewirausahaan', 'Unknown', 'https://chat.whatsapp.com/Jeg7EEfftDuHm0LR20Ldlz', 'staff-internship-2026', 'ACCEPTED'),
('126190060', 'Sidabukke Anggelica', 'Teknik Industri', 'Biro Kewirausahaan', 'Unknown', 'https://chat.whatsapp.com/Jeg7EEfftDuHm0LR20Ldlz', 'staff-internship-2026', 'ACCEPTED'),
('126150069', 'Christella Monavae Natalita', 'Teknik Geologi', 'Biro Kewirausahaan', 'Unknown', 'https://chat.whatsapp.com/Jeg7EEfftDuHm0LR20Ldlz', 'staff-internship-2026', 'ACCEPTED'),
('126260113', 'Yeremia Siringoringo', 'farmasi', 'Biro Kewirausahaan', 'Unknown', 'https://chat.whatsapp.com/Jeg7EEfftDuHm0LR20Ldlz', 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Internal / Event Organizer (tidak ada WA link spesifik di Excel)
('126120102', 'Christian Moses Wijaya', 'Teknik Geofisika', 'Departemen Internal', 'Divisi Event Organizer', null, 'staff-internship-2026', 'ACCEPTED'),
('126220018', 'Zefanya Septiani', 'Perencanaan Wilayah dan Tata Kota', 'Departemen Internal', 'Divisi Event Organizer', null, 'staff-internship-2026', 'ACCEPTED'),
('126430007', 'Keizya Dwi Aryani Telaumbanua', 'Teknik Biomedis', 'Departemen Internal', 'Divisi Event Organizer', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Internal / Harmonisasi
('126280043', 'Chantika Putri Tabitha Hutahaean', 'Teknik Kimia', 'Departemen Internal', 'Divisi Harmonisasi', 'https://chat.whatsapp.com/GB7Cik95HtgLTFpKAfCqLO', 'staff-internship-2026', 'ACCEPTED'),
('126250151', 'Renata Sanjani Lubis', 'Teknik Lingkungan', 'Departemen Internal', 'Divisi Harmonisasi', 'https://chat.whatsapp.com/GB7Cik95HtgLTFpKAfCqLO', 'staff-internship-2026', 'ACCEPTED'),
('126280042', 'Yrene Gresilia Silalahi', 'Teknik Kimia', 'Departemen Internal', 'Divisi Harmonisasi', 'https://chat.whatsapp.com/GB7Cik95HtgLTFpKAfCqLO', 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Pelayanan Khusus / Worship (tidak ada WA link spesifik)
('126150117', 'Moreno Valentino', 'Teknik Geologi', 'Departemen Pelayanan Khusus', 'Divisi Worship', null, 'staff-internship-2026', 'ACCEPTED'),
('126410125', 'Novelia Elisabeth Sitompul', 'Sains Aktuaria', 'Departemen Pelayanan Khusus', 'Divisi Worship', null, 'staff-internship-2026', 'ACCEPTED'),
('126410084', 'Ezra Elizabeth Manondang Panjaitan', 'Sains Aktuaria', 'Departemen Pelayanan Khusus', 'Divisi Worship', null, 'staff-internship-2026', 'ACCEPTED'),
('126210123', 'Relita Iishabela Sitompul', 'Teknik sipil', 'Departemen Pelayanan Khusus', 'Divisi Worship', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Pelayanan Khusus / Worship Creator (tidak ada WA link spesifik)
('126250090', 'Greace Perbina Pepayosa Br Perangin Angin', 'Teknik Lingkungan', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', null, 'staff-internship-2026', 'ACCEPTED'),
('126430005', 'Nelvina Telaumbanua', 'Teknik Biomedis', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', null, 'staff-internship-2026', 'ACCEPTED'),
('126220196', 'Anatasya Daeli', 'Perencanaan Wilayah dan Kota', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', null, 'staff-internship-2026', 'ACCEPTED'),
('126250072', 'Anita Sintia Purba', 'Teknik Lingkungan', 'Departemen Pelayanan Khusus', 'Divisi Worship Creator', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Pelayanan Khusus / Musik
('126120173', 'Jonathan Simanjuntak', 'Teknik Geofisika', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'https://chat.whatsapp.com/E4e6Q38MBoI07biqnUsyGh', 'staff-internship-2026', 'ACCEPTED'),
('126220084', 'Samuel Marchelino Sitepu', 'Perencanaan Wilayah dan Kota', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'https://chat.whatsapp.com/E4e6Q38MBoI07biqnUsyGh', 'staff-internship-2026', 'ACCEPTED'),
('126150101', 'Alfa Gideon Sinaga', 'Teknik Geologi', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'https://chat.whatsapp.com/E4e6Q38MBoI07biqnUsyGh', 'staff-internship-2026', 'ACCEPTED'),
('126410121', 'Praja Estomihi Marthumbur Aritonang', 'Sains Aktuaria', 'Departemen Pelayanan Khusus', 'Divisi Musik', 'https://chat.whatsapp.com/E4e6Q38MBoI07biqnUsyGh', 'staff-internship-2026', 'ACCEPTED'),

-- Departemen CMIT / IT (tidak ada WA link spesifik)
('126140086', 'Magen Sudan Mangisara Tambunan', 'Teknik Informatika', 'Departemen CMIT', 'Divisi IT', null, 'staff-internship-2026', 'ACCEPTED'),
('126370021', 'Leon Irwan Sinaga', 'Teknik Pertambangan', 'Departemen CMIT', 'Divisi IT', null, 'staff-internship-2026', 'ACCEPTED'),
('126120027', 'Grace Naomi R', 'Teknik Geofisika', 'Departemen CMIT', 'Divisi IT', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen CMIT / Publikasi dan Dokumentasi (tidak ada WA link spesifik)
('126140078', 'ARIEL JOHN HOWARD SITANGGANG', 'Teknik Informatika', 'Departemen CMIT', 'Divisi  Publikasi dan Dokumentasi', null, 'staff-internship-2026', 'ACCEPTED'),
('126360105', 'Syelomitha', 'Teknik Material', 'Departemen CMIT', 'Divisi  Publikasi dan Dokumentasi', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen CMIT / Desain
('126120155', 'Jemima Abigail Siagian', 'Teknik Geofisika', 'Departemen CMIT', 'Divisi Desain', 'https://chat.whatsapp.com/CzozKSqmewjACUGIqeawpi', 'staff-internship-2026', 'ACCEPTED'),
('126500058', 'Tio Vanesa Celia Wala', 'Rekayasa kosmetik', 'Departemen CMIT', 'Divisi Desain', 'https://chat.whatsapp.com/CzozKSqmewjACUGIqeawpi', 'staff-internship-2026', 'ACCEPTED'),
('126380108', 'Alice Tamaris Sean Sharon Malau', 'Desain Komunikasi Visual', 'Departemen CMIT', 'Divisi Desain', 'https://chat.whatsapp.com/CzozKSqmewjACUGIqeawpi', 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Eksternal / Intra Kampus (tidak ada WA link spesifik)
('126190182', 'vita yuliani sinaga', 'Teknik Industri', 'Departemen Eksternal', 'Divisi Intra Kampus', null, 'staff-internship-2026', 'ACCEPTED'),
('126160064', 'Dina Naftauli Tambunan', 'Matematika', 'Departemen Eksternal', 'Divisi Intra Kampus', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Eksternal / Ekstra Kampus
('126270021', 'Bagas Ambarita', 'Kimia', 'Departemen Eksternal', 'Divisi Ekstra Kampus', 'https://chat.whatsapp.com/D7WPdVYPrhlB6run0LU4qT', 'staff-internship-2026', 'ACCEPTED'),
('126190196', 'IVAN SASMITRO SIMAMORA', 'Teknik Industri', 'Departemen Eksternal', 'Divisi Ekstra Kampus', 'https://chat.whatsapp.com/D7WPdVYPrhlB6run0LU4qT', 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Operasional / Akomodasi (tidak ada WA link spesifik)
('126310034', 'Ryan Galathy Pakpahan', 'Teknik Biosistem', 'Departemen Operasional', 'Divisi Akomodasi', null, 'staff-internship-2026', 'ACCEPTED'),
('126120171', 'Nathanael Alesandro Tindaon', 'Teknik Geofisika', 'Departemen Operasional', 'Divisi Akomodasi', null, 'staff-internship-2026', 'ACCEPTED'),
('126410056', 'Louis Givin Hadinata Ginting', 'Sains Aktuaria', 'Departemen Operasional', 'Divisi Akomodasi', null, 'staff-internship-2026', 'ACCEPTED'),
('126120204', 'HANNA JOJOR NAPITUPULU', 'TEKNIK GEOFISIKA', 'Departemen Operasional', 'Divisi Akomodasi', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Operasional / Logistik
('126210018', 'Juan Carlos Antonio Manurung', 'Teknik Sipil', 'Departemen Operasional', 'Divisi Logistik', 'https://chat.whatsapp.com/Fn42OxkObuG1XJcsHulj3t', 'staff-internship-2026', 'ACCEPTED'),
('126330133', 'Jonathan Simanjuntak', 'Teknologi Industri Pertanian', 'Departemen Operasional', 'Divisi Logistik', 'https://chat.whatsapp.com/Fn42OxkObuG1XJcsHulj3t', 'staff-internship-2026', 'ACCEPTED'),
('126400022', 'Alva Imanuel Pasaribu', 'Teknik Telekomunikasi', 'Departemen Operasional', 'Divisi Logistik', 'https://chat.whatsapp.com/Fn42OxkObuG1XJcsHulj3t', 'staff-internship-2026', 'ACCEPTED'),
('126410015', 'Aurel Kristin Sihombing', 'Sains Aktuaria', 'Departemen Operasional', 'Divisi Logistik', 'https://chat.whatsapp.com/Fn42OxkObuG1XJcsHulj3t', 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Talenta / Extra Youth (tidak ada WA link spesifik)
('126480045', 'Elgama Lawrensius Sihombing', 'Rekayasa minyak dan gas', 'Departemen Talenta', 'Divisi Extra Youth', null, 'staff-internship-2026', 'ACCEPTED'),
('126350014', 'Sela Agustina Simarmata', 'Teknologi pangan', 'Departemen Talenta', 'Divisi Extra Youth', null, 'staff-internship-2026', 'ACCEPTED'),
('126270026', 'Chelsea Olivia Hutabarat', 'Kimia', 'Departemen Talenta', 'Divisi Extra Youth', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Talenta / Art Interest
('126430142', 'Lim Ing Nababan', 'Teknik Biomedis', 'Departemen Talenta', 'Divisi Art Interest', 'https://chat.whatsapp.com/E9rjhJ0vkHM0IZLP6ra99f', 'staff-internship-2026', 'ACCEPTED'),
('126190180', 'Vidya Miracle Natalie S', 'Teknik Industri', 'Departemen Talenta', 'Divisi Art Interest', 'https://chat.whatsapp.com/E9rjhJ0vkHM0IZLP6ra99f', 'staff-internship-2026', 'ACCEPTED'),
('126340089', 'Natanael Even Bangun', 'Teknik Sistem Energi', 'Departemen Talenta', 'Divisi Art Interest', 'https://chat.whatsapp.com/E9rjhJ0vkHM0IZLP6ra99f', 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Pembinaan Rohani / Doa dan Pemerhati (tidak ada WA link spesifik)
('126360069', 'Gamaliel Glen Sinaga', 'Teknik Material', 'Departemen Pembinaan Rohani', 'Divisi Doa dan Pemerhati', null, 'staff-internship-2026', 'ACCEPTED'),
('126490006', 'Aprilina Sinaga', 'Rekayasa Instrumentasi dan Automasi', 'Departemen Pembinaan Rohani', 'Divisi Doa dan Pemerhati', null, 'staff-internship-2026', 'ACCEPTED'),
('126250134', 'Ririn Setiani Tanjung', 'Teknik Lingkungan', 'Departemen Pembinaan Rohani', 'Divisi Doa dan Pemerhati', null, 'staff-internship-2026', 'ACCEPTED'),

-- Departemen Pembinaan Rohani / Gospel Group
('126260002', 'Gerald Christian Hasudungan Samosir', 'Farmasi', 'Departemen Pembinaan Rohani', 'Divisi Gospel Group', 'https://chat.whatsapp.com/E3o6TRdVL6eB1WJwPwG7z2', 'staff-internship-2026', 'ACCEPTED'),
('126240031', 'Winsan Tri Turnip', 'Arsitektur', 'Departemen Pembinaan Rohani', 'Divisi Gospel Group', 'https://chat.whatsapp.com/E3o6TRdVL6eB1WJwPwG7z2', 'staff-internship-2026', 'ACCEPTED')

on conflict do nothing;

-- 7. Verify insert
select count(*) as total_inserted from public.selection_results where recruitment_slug = 'staff-internship-2026';

-- 8. Show unique departments with their WA links
select distinct departemen, divisi, wa_group_link 
from public.selection_results 
where recruitment_slug = 'staff-internship-2026'
order by departemen, divisi;
