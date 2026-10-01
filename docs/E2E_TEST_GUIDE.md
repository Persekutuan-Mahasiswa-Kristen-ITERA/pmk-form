# Panduan Uji Submit End-to-End (Staging / Form Tes)

Panduan ini untuk **staging atau project Supabase terpisah**. **JANGAN jalankan
di produksi** — langkah-langkah di bawah membuat form baru dan mengirim respons,
yang akan menambah data ke tabel `forms` / `form_responses` / bucket storage.

## 0. Pra-syarat

- Branch `chore/cleanup-and-hardening` sudah dideploy ke staging.
- Environment staging punya:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server action submit butuh ini!)
- Migration 002 sudah dijalankan di DB staging, dengan email admin staging
  pada bagian SEED (`GANTI@EMAIL`).
- Signup publik sudah dimatikan di project staging (dashboard Supabase).
- Browser devtools terbuka (tab Network & Console).

## 1. Buat form tes via admin

1. Login di `/admin/login` dengan email admin staging.
   - ✅ Harus masuk ke `/admin/dashboard`.
2. Klik **Buat Form Baru** → isi:
   - Judul: `FORM UJI E2E (hapus setelah selesai)`
   - Slug: `form-uji-e2e`
   - Jenis: `general`
   - Tanggal buka: sekarang; tanggal tutup: +1 jam (pastikan masih terbuka).
3. Tambahkan field:
   - **Teks Pendek** wajib → label `Nama Lengkap`
   - **Upload Lampiran** (tidak wajib) → label `CV`
   - **Radio** wajib → label `Pilihan`, opsi `A` / `B`
4. Tab **Pengaturan Tambahan** → aktifkan "Kumpulkan Identitas" (default on).
5. Klik **Simpan Form**.

**Verifikasi:**
- ✅ Toast "Form baru berhasil dibuat." dan redirect ke `/admin/forms`.
- ✅ Form muncul di landing page `/` (kategori "Umum").

## 2. Uji submit valid (happy path)

1. Buka `/form/form-uji-e2e` di tab incognito (anon).
2. Isi Nama, pilih radio A, **tidak** upload CV (field tidak wajib).
3. Klik **Kirim Respons**.

**Verifikasi:**
- ✅ Redirect ke `/form/form-uji-e2e/success` — pesan terima kasih default.
- ✅ Di tab Network: POST ke server action `submitFormResponseAction`, response
  `{ success: true, responseId: "…" }`.
- ✅ Console: **tidak ada error**.

## 3. Verifikasi data tersimpan benar (key = field.id)

Jalankan di SQL Editor staging (read-only):

```sql
select id, form_id, answers, files, submitted_at
from public.form_responses
where form_id = (select id from public.forms where slug = 'form-uji-e2e')
order by submitted_at desc
limit 1;
```

**Verifikasi:**
- ✅ `answers` di-key oleh **field.id** (mis. `field_1730000000000`), **bukan**
  label (`"Nama Lengkap"`). Ini konfirmasi perbaikan key mismatch.
- ✅ `files` = `[]` (tidak ada lampiran).
- ✅ Tidak ada key asing / injection.

## 4. Uji upload lampiran

1. Ulangi langkah 2, tapi kali ini **upload file PDF** kecil (< 10MB) di field CV.
2. Kirim.

**Verifikasi:**
- ✅ Sukses redirect ke halaman success.
- ✅ SQL Editor: `files` berisi 1 URL `https://…/form-attachments/…`.
- ✅ URL bisa dibuka (bucket public).

**Uji penolakan (harus gagal, pesan aman):**
- Upload file `.exe` / `.zip` → pesan "Ekstensi file tidak didukung…".
- Upload file > 10MB → pesan "Ukuran file terlalu besar…".
- Rename `evil.exe` → `evil.pdf` → **harus tetap ditolak** oleh server action
  (cek MIME type) atau bucket policy `allowed_mime_types` (migration 005).

## 5. Uji validasi server (bypass client = wajib lolos)

Ini tes **paling penting** — membuktikan validasi ada di server, bukan cuma UI.

Pakai curl / Postman, panggil server action secara langsung. Endpoint action
ada di header `Next-Action` di tab Network saat submit normal (salin URL +
header `Next-Action` + body form-data).

**5a. Form yang sudah ditutup:**
```sql
-- Tutup form dulu di staging:
update public.forms set is_open = false where slug = 'form-uji-e2e';
```
Kirim payload valid via curl → **harus gagal** dengan `"Form ini sudah ditutup."`.
Lalu buka lagi: `update public.forms set is_open = true where slug = 'form-uji-e2e';`

**5b. Lewati validasi client (kirim field wajib kosong):**
Kirim body dengan `Nama Lengkap` kosong → **harus gagal** dengan
`"… wajib diisi."` (pesan dari skema Zod server).

**5c. Key asing harus di-strip:**
Kirim `{"field_applicant_nim": "99999999", "haxxor": "<script>"}` bersama
field wajib → **harus sukses**, tapi SQL Editor menunjukkan hanya field yang
dideklarasikan yang tersimpan (key `haxxor` & `field_applicant_nim` **tidak** ada).

**5d. max_responses:**
```sql
update public.forms
set settings = jsonb_set(settings, '{max_responses}', '1')
where slug = 'form-uji-e2e';
```
Kirim 2 respons → yang **kedua harus gagal** dengan
`"Kuota pengisian form ini sudah penuh."`. Reset: `'{max_responses}', 'null'`.

**5e. Duplikat NIM:**
Form uji tidak punya field `field_applicant_nim`, jadi duplikat **tidak** dicek
oleh design. Untuk menguji: tambahkan field teks, edit definisi field di SQL
Editor agar salah satu field punya `id: 'field_applicant_nim'`, lalu kirim 2x
dengan NIM sama → yang kedua harus gagal `"Anda sudah mengirim respons…"`.

## 6. Uji otorisasi (Fase 1)

**6a. Non-admin terkunci dari admin:**
1. Signup user baru di staging (temporarily enable signup, lalu matikan lagi).
2. Login → buka `/admin/dashboard`.
   - ✅ Harus tampil halaman **"Akses Ditolak"** (bukan dashboard).
   - ✅ Tidak ada data form/respons yang bocor.
3. Coba panggil `createFormAction` / `deleteFormResponseAction` via curl dengan
   session cookie user biasa → **harus gagal** `"Anda tidak memiliki izin admin."`

**6b. Anon tidak bisa baca respons:**
```bash
curl -H "apikey: $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/form_responses?select=answers&limit=5"
```
- ✅ Hasilnya `[]` (RLS menghalangi baca anon).

**6c. Service role tidak bocor:**
- ✅ Grep bundle client (lihat laporan): literal key tidak ada di `.next/static`.

## 7. Uji Cek Hasil (legacy)

1. Buka `/hasil`.
2. Isi NIM + email pendaftar yang ada di `selection_results` (staging).
   - ✅ Status ACCEPTED/NOT_ACCEPTED tampil benar.
3. Kirim > 15x dalam 1 menit → ✅ HTTP 429 "Terlalu banyak permintaan…".

## 8. Bersih-bersih (staging only)

```sql
-- Hapus data uji dari staging (JANGAN di produksi!)
delete from public.form_responses
where form_id = (select id from public.forms where slug = 'form-uji-e2e');
delete from public.forms where slug = 'form-uji-e2e';
```

Hapus juga file di bucket `form-attachments` yang terbuat saat uji upload
(menu Storage di dashboard Supabase, folder nama form-id).

## Checklist hasil

| Tes | Hasil |
|---|---|
| Submit valid (happy path) | ☐ |
| Data tersimpan dengan key field.id | ☐ |
| Upload lampiran sukses + penolakan exe/oversized | ☐ |
| Validasi server: form ditutup ditolak | ☐ |
| Validasi server: field wajib kosong ditolak | ☐ |
| Key asing di-strip | ☐ |
| max_responses dienforce | ☐ |
| Non-admin terkunci (403 + action ditolak) | ☐ |
| Anon tidak bisa baca respons | ☐ |
| Cek hasil + rate limit 429 | ☐ |
