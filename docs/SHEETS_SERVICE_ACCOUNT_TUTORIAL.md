# Tutorial: Service Account Google Sheets + Import ke Env Lokal

Tujuan: aplikasi bisa menulis mirror respons ke spreadsheet Anda, dan Anda
**tinggal menjalankan 1 perintah import** — tidak perlu edit `.env` manual.

Waktu: ±10 menit. Yang Anda butuhkan: akun Google + browser.

> File kredensial (`.json`) dan `.env` **tidak boleh di-commit**.
> Keduanya sudah/akan dikecualikan dari git (`.env` sudah di `.gitignore`).
> Setelah import, hapus file JSON atau simpan di luar repo.

---

## BAGIAN A — Buat service account (di browser, ±7 menit)

### A1. Buat project di Google Cloud Console

1. Buka <https://console.cloud.google.com/> dan login akun Google Anda.
2. Klik pemilih project di bar atas → **New Project**.
3. Isi nama mis. `pmk-form-sheets` → **Create**. Tunggu notifikasi selesai,
   lalu pilih project tersebut.

### A2. Aktifkan Google Sheets API

1. Di project tadi, buka **APIs & Services → Library**
   (atau langsung: <https://console.cloud.google.com/apis/library>).
2. Cari `Google Sheets API` → klik → **Enable**.
3. Tunggu sampai statusnya enabled.

### A3. Buat service account

1. Buka **IAM & Admin → Service Accounts**
   (atau langsung: <https://console.cloud.google.com/iam-admin/serviceaccounts>).
2. Klik **+ Create Service Account**.
3. Isi nama mis. `pmk-form-sheets` (ID terisi otomatis) → **Create and Continue**.
4. **Grant access (langkah 2): JANGAN pilih role apa pun** → **Continue**.
   (Akses cukup lewat share spreadsheet nanti, bukan lewat IAM project.)
5. Langkah 3 (grant users): kosongkan → **Done**.

### A4. Download kunci JSON

1. Klik email service account yang baru dibuat
   (bentuknya `nama@nama-project.iam.gserviceaccount.com`) — **catat email ini**,
   dipakai di Bagian C.  
2. Tab **Keys → Add Key → Create new key → JSON** → **Create**.
3. File `.json` ter-download (mis. ke `~/Downloads/`). **Jangan dibagikan
   ke siapa pun.**

---

## BAGIAN B — Import sekali jalan (±1 menit)

Di terminal, dari folder repo:

```bash
./scripts/import-sheets-env.sh ~/Downloads/pmk-form-3bc0fc5188b1.json
```

Ganti `NAMA-FILE-KUNCI.json` dengan nama file yang ter-download di A4.
Skrip akan membaca `client_email` + `private_key` dari JSON, lalu menulis /
memperbarui 3 baris di `.env`:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — email service account
- `GOOGLE_PRIVATE_KEY` — private key dijadikan **satu baris** (`\n` literal,
  diapit tanda kutip — persis format yang dibaca `lib/sheets/client.ts`)
- `CRON_SECRET` — dibuatkan acak **hanya bila belum ada**
  (dipakai endpoint cron produksi; lokal tidak wajib tapi tidak berbahaya)

Baris `.env` lain (Supabase dkk) **tidak disentuh**. Contoh output:

```text
OK: .env diperbarui -> /home/.../pmk-form/.env
  GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@....iam.gserviceaccount.com
  GOOGLE_PRIVATE_KEY=(satu baris, ... char, diapit kutip)
  CRON_SECRET=(baru dibuat acak)
```

Verifikasi cepat (opsional, nilai disamarkan):

```bash
grep -E "GOOGLE_|CRON_SECRET" .env | sed 's/=.*/=<terisi>/'
# harus 3 baris: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, CRON_SECRET
```

### Kalau salah file / mau ganti akun

Jalankan ulang perintah yang sama dengan file JSON yang benar — skrip
menimpa 2 baris Google (tidak menduplikat), dan tidak mengubah
`CRON_SECRET` yang sudah ada.

---

## BAGIAN C — Share spreadsheet TES + uji koneksi (±2 menit)

### C1. Buat spreadsheet tes (data DUMMY saja)

1. Buka <https://sheets.google.com/> → **Blank spreadsheet** baru, mis. `TES PMK Form`.
2. Klik **Share** → tambah email service account (dari A4) → peran **Editor** →
   hilangkan centang *Notify people* (opsional) → **Share**.

> Tanpa langkah ini, tombol Tes Koneksi melaporkan 403 beserta email yang
> harus ditambahkan. Spreadsheet produksi juga harus di-share satu per satu.

### C2. Uji dari aplikasi

1. Restart dev server bila sedang jalan (`npm run dev` ulang agar `.env` terbaca).
2. Buka halaman **edit form** (admin) → panel **Integrasi Google Sheets**.
   Email service account tampil di panel — cocokkan dengan email A4.
3. Tempel URL spreadsheet tes → nama sheet `Sheet1` → **Simpan** → **Tes Koneksi**.
   - ✅ `Terhubung. Sheet "Sheet1" siap.` → selesai, lanjut uji submit dummy.
   - ❌ `belum di-share...` → ulangi C1 (pastikan email persis + peran Editor).
   - ❌ `Spreadsheet tidak ditemukan` → cek URL/ID.
   - ❌ `Kredensial ... belum dikonfigurasi` → `.env` belum terbaca → cek Bagian B
     lalu restart dev server.

### C3. Bereskan file kunci

Hapus file JSON dari `~/Downloads/` (atau pindahkan ke luar repo, mis.
folder dokumen pribadi). Jangan pernah commit `.env` maupun file JSON —
cek dengan `git status` (keduanya tidak boleh muncul).

---

## Nanti saat deploy produksi (pengingat, bukan sekarang)

Nilai yang sama diisi di Vercel → **Settings → Environment Variables**
(`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` satu baris seperti di
`.env`, `CRON_SECRET`), plus jalankan `migrations/010_sheets_integration.sql`
di Supabase SEBELUM deploy. Detail: `docs/SHEETS_SETUP.md`.
