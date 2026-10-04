# Panduan Integrasi Google Sheets (Fase 6)

Mirror satu arah: setiap respons form otomatis disalin ke Google Spreadsheet.
**`form_responses` tetap sumber kebenaran** — edit di sheet tidak mengalir balik.
Kegagalan Google **tidak** menggagalkan submit pendaftar (hanya mengubah status outbox).

> Form tanpa konfigurasi berperilaku persis seperti sekarang (fitur opsional per form).
> Uji dengan **data DUMMY** dulu di form tes + spreadsheet tes (langkah 6.5.4) —
> jangan uji dengan data produksi.

---

## LANGKAH 1: Buat Google Cloud project + service account (manual, sekali saja)

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project baru
   (mis. `pmk-form-sheets`).
2. Di project tersebut: **APIs & Services → Library** → cari **Google Sheets API** → **Enable**.
3. **IAM & Admin → Service Accounts → Create Service Account**:
   - Nama mis. `pmk-form-sheets`. **Jangan** beri role project apa pun
     (akses cukup lewat share spreadsheet, bukan IAM project).
4. Buka service account → tab **Keys → Add Key → Create new key → JSON** → download.
   File JSON berisi `client_email` dan `private_key`.

## LANGKAH 2: Isi env di Vercel (server saja)

Di Vercel → project → **Settings → Environment Variables**:

| Variable | Isi |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` dari JSON (mis. `xxx@....iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | `private_key` dari JSON. **Tulis `\n` sebagai literal backslash-n** (kode mengubahnya jadi newline asli). Jangan commit file nyata. |
| `CRON_SECRET` | String acak 64 char. Hasilkan: `openssl rand -hex 32` |

Contoh format private key di Vercel (satu baris, diawali & diakhiri tanda kutip):

```text
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

Lihat `.env.example` untuk template lokal.

## LANGKAH 3: Jalankan migration 010 (manual, SEBELUM deploy)

Di Supabase Dashboard → SQL Editor, jalankan isi file
`migrations/010_sheets_integration.sql` **verbatim** (satu transaksi).

Verifikasi pasca-migration (query ada di komentar file):

- `sheets_config | jsonb` ada di `forms` (1 baris).
- Tabel `sheets_outbox` + 2 index ada.
- Policy `Admins can manage sheets_outbox | ALL` ada.
- Total forms tetap 8, responses tetap 240, `sheets_config IS NULL` = 8.

Rollback aman tersedia di komentar akhir file (hanya menghapus objek baru;
`form_responses` tidak tersentuh).

## LANGKAH 4: Per form (di halaman edit form admin)

1. Buat spreadsheet baru (manual, satu spreadsheet per form).
2. **Share spreadsheet sebagai Editor ke email service account**
   (dari langkah 2). Tanpa ini, tombol Tes koneksi melaporkan 403 beserta email
   yang harus ditambahkan.
3. Di panel **Integrasi Google Sheets**:
   - Tempel URL spreadsheet (ID diekstrak otomatis) + nama sheet (tab).
   - Klik **Simpan**, lalu **Tes Koneksi**.
   - Aktifkan toggle **sinkronisasi otomatis**.
4. Untuk data lama: klik **Sinkronkan Semua Respons** (backfill batched,
   idempoten — aman diulang). Baris yang gagal bisa dicoba ulang dengan
   **Coba Ulang yang Gagal**.

## Cara kerja (ringkas, untuk audit)

- Submit publik → respons disimpan → baris `pending` masuk `sheets_outbox`
  (satu INSERT murah) → sinkronisasi berjalan **setelah** respons dikirim ke
  pendaftar via `after()` (tidak menambah latency; kegagalan hanya jadi
  status outbox).
- Retry otomatis via endpoint `/api/cron/sheets-sync` yang dilindungi
  `CRON_SECRET` (constant-time compare). Backoff eksponensial
  1→2→4→...→60 menit, maks 5 percobaan lalu `failed`.
  - **Vercel Cron bawaan (`vercel.json`): 1x sehari** (`0 18 * * *` = tiap
    jam 18.00 UTC / 01.00 WIB). Paket Hobby hanya mengizinkan cron harian —
    ekspresi yang lebih sering membuat **deployment gagal total**.
    Sebagai jaring pengaman harian bila cron eksternal mati.
  - **Retry cepat tiap 5 menit: pakai cron EKSTERNAL gratis** (lihat
    "Retry cepat (opsional)" di bawah). Ini jalur utama retry — tanpa ini,
    respons yang gagal sync menunggu sampai cron harian berikutnya.
- Idempotensi: kolom terakhir sheet `__response_id` dicek sebelum append —
  retry tidak pernah membuat baris ganda. Outbox juga PK di `response_id`.
- Keamanan tulis: mode **RAW** (tidak mengevaluasi formula) + escape nilai
  berawalan `= + - @` dengan kutip tunggal. `last_error` disanitasi
  (tanpa PII/secret, maks 250 char). Tidak ada PII di log server.
- Perubahan field form: tambah → kolom baru di kanan; hapus → kolom lama
  dipertahankan; rename → hanya header diperbarui. Data lama ber-key label
  tetap terbaca via fallback (`answers[field.id] ?? answers[field.label]`).

## Retry cepat tiap 5 menit (opsional, gratis — cron eksternal)

Vercel Cron paket Hobby hanya 1x sehari. Supaya respons yang gagal sync
tidak menunggu sampai besok, daftarkan URL cron ke salah satu layanan gratis:

- **cron-job.org** (gratis): buat akun → Create cronjob → URL:
  `https://form.pmkitera.web.id/api/cron/sheets-sync` → Schedule every 5 minutes.
- **GitHub Actions** (gratis, tanpa akun baru): workflow `schedule: '*/5 * * * *'`
  yang `curl` URL cron.
- **UptimeRobot/Uptime Kuma**: monitor HTTP tiap 5 menit ke URL cron
  (efek sampingnya sekaligus health-check).

Semua opsi memanggil dengan header wajib:

```text
Authorization: Bearer <isi CRON_SECRET yang sama dengan di Vercel>
```

Tanpa header ini endpoint menjawab 401. Respons sukses: `{"ok":true,
"processed":N,"synced":N,...}` (hanya jumlah, tanpa PII).

## Yang TIDAK bisa diverifikasi otomatis

- Google Sheets API asli (perlu spreadsheet tes + kredensial asli).
- Vercel Cron berjalan (cek log cron setelah deploy).
- Share spreadsheet ke service account (manual per spreadsheet).

Panduan uji end-to-end staging: buat form tes + spreadsheet tes berisi data
dummy → submit dummy → cek baris muncul (kolom terakhir `__response_id`
= ID respons) → matikan share → submit lagi → status `pending/failed` di
panel (submit tetap sukses) → share kembali → cron retry mengubah jadi
`synced` tanpa duplikat.
