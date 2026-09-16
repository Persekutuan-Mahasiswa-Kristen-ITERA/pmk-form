# Supabase Setup Guide: PMK ITERA Form Platform

Dokumen ini menjelaskan panduan setup database Supabase untuk Platform Form Generik PMK ITERA.

---

## 1. Variabel Lingkungan (.env.local)

Pastikan variabel berikut terpasang di `.env.local` dan environment Vercel/VPS:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Dibutuhkan untuk API route /api/cek-hasil
```

---

## 2. Skema Tabel & Migrasi

Jalankan script SQL di **Supabase SQL Editor**:

1. Buka file `migrations/001_generic_forms_migration.sql`.
2. Copy seluruh isinya dan jalankan di SQL Editor Supabase.

### Ringkasan Tabel Baru:
- **`public.forms`**: Menyimpan definisi form, jenis form (`recruitment`, `event`, `survey`, `presensi`, `general`), `form_fields` JSONB, dan `settings` JSONB.
- **`public.form_responses`**: Menyimpan seluruh jawaban pengisi (`answers` JSONB) dan lampiran file (`files` JSONB).
- **`public.user_roles`**: Menyimpan role admin berjenjang (`super_admin`, `divisi_admin`).
- **`public.selection_results`**: Menyimpan data pengumuman hasil seleksi (untuk fitur `/hasil`).

---

## 3. Storage Bucket Setup

Script migrasi `001_generic_forms_migration.sql` sudah otomatis membuat bucket berikut:
- **`form-attachments`** (Public): Menyimpan seluruh lampiran file dari form generik (PDF, JPG, PNG, DOC, DOCX, maks 10MB).
- **`recruitment-files`** (Public): Mempertahankan bucket lama untuk oprec yang sedang berjalan.

---

## 4. Keamanan & Row Level Security (RLS)

- **`forms`**: Publik hanya bisa membaca form yang `is_open = true`. Admin terautentikasi dapat membaca & mengelola seluruh form.
- **`form_responses`**: Publik (`anon` & `authenticated`) diperbolehkan `INSERT` (submit respons). Hanya admin terautentikasi yang dapat membaca atau menghapus respons.
- **`user_roles`**: Hanya `super_admin` yang dapat mengelola peran pengguna.

---

## 5. Rollback (Jika Diperlukan)

Jika terjadi masalah dan ingin mengembalikan skema tanpa mengganggu data lama:
- Jalankan script `migrations/001_generic_forms_rollback.sql` di Supabase SQL Editor.
