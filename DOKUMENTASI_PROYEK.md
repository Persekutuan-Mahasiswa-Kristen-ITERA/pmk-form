# Dokumentasi Sistem — Platform Form Generik PMK ITERA

Dokumen ini berisi dokumentasi teknis, arsitektur, skema database, rute aplikasi, serta **penandaan perubahan (changelog/diff)** setelah transformasi dari portal recruitment spesifik menjadi platform form generik.

---

## 📌 Ringkasan Perubahan Utama (Apa yang Telah Berubah)

> **[TERUBAH] Transformasi Arsitektur Database & Backend**
> - **Sebelumnya**: Hanya mendukung Open Recruitment dengan tabel hardcoded `recruitments` & `submissions`.
> - **Sekarang**: Mendukung multi-jenis form (`recruitment`, `event`, `survey`, `presensi`, `general`) melalui tabel generik `forms` dan `form_responses`.
> - **Integritas Data**: Data lama dari `recruitments` & `submissions` telah **dimigrasi 100% tanpa ada data yang hilang**. Tabel lama tetap dipertahankan untuk backward-compatibility.

### Tabel Perbandingan Sebelum vs Sesudah

| Fitur / Komponen | Sebelum Transformasi | Sesudah Transformasi (Saat Ini) | Status |
| :--- | :--- | :--- | :--- |
| **Jenis Form** | Hanya Open Recruitment | Multi-jenis: Recruitment, Event, Survei, Presensi, Umum | **[BARU]** |
| **Tabel Form Utama** | `public.recruitments` | `public.forms` (memiliki kolom `form_type` & `settings` JSONB) | **[BARU]** |
| **Tabel Respons** | `public.submissions` | `public.form_responses` (semua identitas disimpan di `answers` JSONB) | **[BARU]** |
| **Penyimpanan Identitas** | Kolom terpisah (`applicant_nim`, dll) | Generik di dalam `answers` JSONB (mendukung anonim / tanpa NIM) | **[TERUBAH]** |
| **Storage Bucket** | `recruitment-files` (PDF saja) | `form-attachments` (PDF, JPG, PNG, DOC, DOCX maks 10MB) | **[BARU]** |
| **Form Builder Admin** | `RecruitmentBuilder.tsx` | `GenericFormBuilder.tsx` (7 tipe field, drag-drop, tab settings) | **[BARU]** |
| **Dashboard Admin** | `/admin/recruitments` | `/admin/forms` (filter jenis form, statistik, & respons viewer) | **[BARU]** |
| **Landing Page Publik** | Hero tetap dan kartu khusus `RecruitmentCard` dari tabel `recruitments` | Hero diperbarui, filter kategori, quick action Cek Hasil & Masuk Admin, serta kartu generik lintas jenis form dari tabel `forms` | **[TERUBAH]** |
| **Renderer Publik** | `/recruitment/[slug]` | `/form/[slug]` (renderer generik dinamis dengan Zod validation) | **[BARU]** |
| **Export Data** | Hanya CSV & ZIP Oprec | Export CSV dinamis & Export ZIP Lampiran per-form | **[TERUBAH]** |
| **Model Akses/Role** | Single role admin (`authenticated`) | Merekam peran berjenjang di `public.user_roles` (`super_admin`, `divisi_admin`) | **[BARU]** |
| **Oprec Berjalan** | Terbatas pada recruitment tunggal | Tetap berjalan normal via rute/tabel lama tanpa terganggu | **[DIPERTAHANKAN]** |

---

## 🏗️ Arsitektur & Stack Teknologi

- **Framework**: Next.js 16.3.4 (App Router + Turbopack)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + `shadcn/ui` + Framer Motion
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Form Handling**: `react-hook-form` + `zod`
- **Drag & Drop**: `@dnd-kit/core` & `@dnd-kit/sortable`
- **Export Utilities**: `papaparse` (CSV), `jszip` + `file-saver` (ZIP)

---

## 🗄️ Skema Database (Supabase)

### 1. Tabel `public.forms` **[BARU]**
Menyimpan definisi form, jenis, kustomisasi field, dan pengaturan.

| Kolom | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique Identifier |
| `title` | `text` | Judul Form |
| `description` | `text` | Deskripsi / Instruksi |
| `slug` | `text` (Unique) | Slug URL Publik (`/form/[slug]`) |
| `form_type` | `text` | Jenis: `'recruitment'`, `'event'`, `'survey'`, `'presensi'`, `'general'` |
| `is_open` | `boolean` | Status buka/tutup form |
| `open_date` | `timestamptz` | Tanggal mulai pengisian |
| `close_date` | `timestamptz` | Tanggal tenggat pengisian |
| `form_fields` | `jsonb` | Array konfigurasi field (`id`, `type`, `label`, `required`, `options`, dll) |
| `settings` | `jsonb` | Pengaturan tambahan (`wa_group_link`, `thank_you_message`, `allowed_angkatan`) |
| `created_by` | `uuid` (FK) | User ID pembuat form |
| `created_at` | `timestamptz` | Waktu dibuat |
| `updated_at` | `timestamptz` | Waktu terakhir diubah |

### 2. Tabel `public.form_responses` **[BARU]**
Menyimpan seluruh jawaban dari pengisi form.

| Kolom | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique Identifier |
| `form_id` | `uuid` (FK) | Relasi ke `public.forms(id)` |
| `answers` | `jsonb` | Key-value jawaban pengisi (Key = `field.id`) |
| `files` | `jsonb` | Array URL file lampiran publik |
| `respondent_id`| `uuid` (FK) | ID Pengguna (jika pengisian butuh login) |
| `submitted_at` | `timestamptz` | Waktu submit |
| `updated_at` | `timestamptz` | Waktu update |

### 3. Tabel `public.user_roles` **[BARU]**
Menyimpan peran admin berjenjang.

| Kolom | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique Identifier |
| `user_id` | `uuid` (FK) | Relasi ke `auth.users(id)` |
| `role` | `text` | `'super_admin'` atau `'divisi_admin'` |
| `division` | `text` | Nama Divisi (misal: 'Humas', 'Acara') |

---

## 🗺️ Struktur Rute Aplikasi (App Router)

### Rute Publik
- **`/`**: Landing page utama (menampilkan form & recruitment yang aktif).
- **`/form/[slug]`** **[BARU]**: Renderer publik untuk mengisi form generik.
- **`/form/[slug]/success`** **[BARU]**: Halaman konfirmasi setelah berhasil submit form + QR / link WhatsApp.
- **`/hasil`**: Halaman pengumuman & pencarian hasil seleksi (menggunakan NIM + Email).
- **`/recruitment/[slug]`**: Rute publik oprec lama (dipertahankan untuk kompatibilitas).

### Rute Admin (Proteksi Auth & Middleware `proxy.ts`)
- **`/admin/login`**: Halaman login admin.
- **`/admin/dashboard`**: Dashboard ringkasan statistik & aktivitas terbaru.
- **`/admin/forms`** **[BARU]**: Daftar seluruh form lintas jenis dengan filter chip.
- **`/admin/forms/new`** **[BARU]**: Form builder untuk membuat form baru.
- **`/admin/forms/[id]`** **[BARU]**: Form builder untuk mengedit form.
- **`/admin/forms/[id]/responses`** **[BARU]**: Viewer tabel respons & tombol Export CSV/ZIP.
- **`/admin/recruitments`**: Rute admin oprec lama (dipertahankan).

---

## 📁 Struktur File & Folder Penting

```
pmk-form/
├── app/
│   ├── actions/
│   │   ├── deleteResponse.ts   # [BARU] Server Action hapus respons form
│   │   ├── forms.ts            # [BARU] Server Action create/update form
│   │   ├── revalidate.ts       # [TERUBAH] Helper invalidasi cache Next.js
│   │   └── uploadFile.ts       # [TERUBAH] Upload lampiran ke form-attachments
│   ├── admin/
│   │   └── (dashboard)/
│   │       ├── forms/          # [BARU] Rute manajemen form generik admin
│   │       └── recruitments/   # Rute oprec lama
│   ├── api/
│   │   └── cek-hasil/          # API Route cek hasil seleksi (Service Role)
│   └── form/                   # [BARU] Rute pengisian form publik generik
├── components/
│   ├── GenericFormBuilder.tsx  # [BARU] Komponen builder drag-drop dnd-kit
│   ├── GenericFormRenderer.tsx # [BARU] Komponen renderer form publik
│   ├── GenericResponseTable.tsx# [BARU] Tabel respons + Export CSV/ZIP
│   └── FormFieldRenderer.tsx   # Renderer UI elemen input
├── lib/
│   ├── forms.ts                # [BARU] Service layer CRUD database forms
│   └── supabase/               # Client & Server Supabase factories
├── migrations/
│   ├── 001_generic_forms_migration.sql # [BARU] Script SQL migrasi database
│   └── 001_generic_forms_rollback.sql  # [BARU] Script SQL rollback
├── types/
│   └── forms.ts                # [BARU] Definisi antarmuka TypeScript
├── README.md                   # [TERUBAH] Panduan proyek utama
└── SUPABASE_SETUP.md           # [TERUBAH] Panduan setup & skema database
```

---

## 🚀 Panduan Operasional

### Menjalankan Server Lokal
```bash
cd /home/fycode/Documents/pmk-form
npm run dev -- -H 0.0.0.0
```
Server dapat diakses di jaringan lokal melalui: `http://192.168.18.4:3000`

### Melakukan Build & Production Check
```bash
npm run build
```
Pastikan kompilasi Turbopack dan TypeScript lulus 100% tanpa error.

---
*Dokumentasi ini dibuat otomatis setelah penyelesaian Fase 0 s.d. 6 Transformasi Form Generik PMK ITERA.*
