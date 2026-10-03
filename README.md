# Platform Form Generik PMK ITERA

Sistem Manajemen Form Serbaguna untuk seluruh divisi & kepanitiaan **PMK ITERA** (pendaftaran acara, survei, presensi, dan open recruitment).

## 🚀 Fitur Utama
- **Multi-Jenis Form**: Mendukung `recruitment`, `event`, `survey`, `presensi`, dan `general`.
- **Form Builder Dinamis**: Drag-and-drop urutan pertanyaan dengan pilihan tipe field lengkap (Teks Pendek, Teks Panjang, Dropdown, Radio, Checkbox Group, Tanggal, dan Upload Lampiran).
- **Public Renderer Generik**: Halaman pengisian form responsif di `/form/[slug]` dengan validasi Zod dinamis & upload file ke bucket Supabase.
- **Manajemen Respons & Export**: Tabel viewer per-form, export data ke **CSV** (PapaParse), dan export seluruh lampiran ke **ZIP** (JSZip).
- **Kompatibilitas Penuh**: Data oprec lama (`submissions`, `selection_results`) tetap utuh dan terlayani cek-hasil. Route lama `/recruitment/[slug]` dan `/admin/recruitments` sudah tidak ada — renderer generik `/form/[slug]` adalah satu-satunya jalur publik.

---

## 🛠️ Stack Teknologi
- **Frontend**: Next.js 16 (App Router + Turbopack), React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend & Database**: Supabase (PostgreSQL + Auth + Storage)
- **Library Pendukung**: `@dnd-kit` (drag-and-drop), `react-hook-form` + `zod` (validasi), `papaparse` (CSV), `jszip` + `file-saver` (ZIP), `lucide-react` (ikon)

---

## 🏁 Cara Menjalankan Lokal

```bash
# 1. Clone & install
git clone https://github.com/Persekutuan-Mahasiswa-Kristen-ITERA/pmk-form.git
cd pmk-form
npm install

# 2. Setup Environment Variables (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 3. Jalankan Server Dev
npm run dev
```

Buka `http://localhost:3000` di browser.

---

## 📂 Struktur Aplikasi

- `/form/[slug]` — Halaman pengisian form publik generik
- `/form/[slug]/success` — Halaman konfirmasi sukses + grup WA
- `/admin/forms` — Dashboard manajemen seluruh form
- `/admin/forms/new` — Builder untuk membuat form baru
- `/admin/forms/[id]` — Builder untuk mengedit form
- `/admin/forms/[id]/responses` — Viewer respons & export CSV/ZIP
- `/hasil` — Cek hasil seleksi (arsip rekrutmen lama + form baru via `form_responses`)

---

## 📄 Migrasi Database

File SQL migrasi berada di folder `migrations/`:
- `migrations/001_generic_forms_migration.sql`: Jalankan di **Supabase SQL Editor** untuk membuat tabel `forms`, `form_responses`, `user_roles`, RLS policies, dan menyalin data lama secara otomatis.
- `migrations/001_generic_forms_rollback.sql`: Script rollback cadangan jika diperlukan.

Detail setup Supabase lengkap dapat dilihat di [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

---
*Dikembangkan untuk Persekutuan Mahasiswa Kristen (PMK) ITERA.*
