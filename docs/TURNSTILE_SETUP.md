# Panduan Setup Cloudflare Turnstile (Fase 7-2)

Verifikasi anti-bot di submit form publik. **Gratis**, tanpa dependency npm baru
(script resmi Cloudflare), dan jauh lebih efektif daripada rate limit in-memory.

## Cara kerja (singkat)

1. Browser menampilkan widget Turnstile (site key bersifat **publik**).
2. Widget memberi *token* sekali pakai.
3. Token dikirim ke server action bersama jawaban form.
4. Server memvalidasi token ke Cloudflare memakai **secret key** (tidak pernah
   dikirim ke browser). Token palsu/expire → submit **ditolak**.

> **Kegagalan infrastruktur Cloudflare tidak menggagalkan submit.** Jika
> endpoint `siteverify` Cloudflare sendiri error/timeout, pendaftar tetap
> diperbolehkan lanjut (lihat `lib/turnstile.ts`). Tapi token *kosong* tetap
> ditolak — jadi menonaktifkan widget lewat devtools tidak lolos.

## LANGKAH 1: Buat site di Cloudflare (±3 menit)

1. Buka <https://dash.cloudflare.com> → login / daftar (gratis).
2. Menu kiri → **Turnstile** → **Add site**.
3. Isi:
   - **Site name**: mis. `PMK Form`
   - **Domain**: `form.pmkitera.web.id` (domain produksi). Untuk pengujian
     lokal, centang juga `localhost` (atau pakai domain testing bawaan).
   - **Widget mode**: **Managed** (disarankan — Cloudflare memilih tantangan
     sesuai risiko; pengguna normal sering tidak melihat apa pun).
4. **Create**.

Anda mendapat dua nilai: **Site Key** (publik) dan **Secret Key** (rahasia).

## LANGKAH 2: Isi env

**Lokal** (`.env`, file ini sudah di-`.gitignore`):

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAxxxxxxxxxxxxxxxx
TURNSTILE_SECRET_KEY=0x4AAAAAAAyyyyyyyyyyyyyyyy
```

**Produksi** (Vercel → Settings → Environment Variables), isi keduanya lalu
**Redeploy** agar terbaca:

| Variable | Nilai | Prefix NEXT_PUBLIC? |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key | ✅ ya (perlu di browser) |
| `TURNSTILE_SECRET_KEY` | Secret Key | ❌ TIDAK (server saja) |

> **Keduanya kosong = fitur nonaktif total.** Form berperilaku seperti biasa.
> Jadi aman men-deploy dulu sebelum key tersedia.

## LANGKAH 3: Aktifkan per form (opsional)

Default: **aktif untuk semua form** begitu key dikonfigurasi.

Untuk mematikan di form tertentu (mis. form internal yang dipercaya):
halaman **edit form** → tab **Pengaturan Tambahan** → matikan switch
**"Verifikasi Anti-Bot (Cloudflare Turnstile)"** → Simpan.

Logika di server (`submitResponse.ts`): captcha berjalan jika
`settings.require_captcha !== false` **dan** key dikonfigurasi.

## LANGKAH 4: Uji

1. Buka form publik → widget Turnstile tampil di atas tombol Kirim.
2. Isi form → selesaikan tantangan (mode Managed sering tidak menampilkan
   apa pun untuk pengguna normal) → Kirim.
3. **Harus sukses** dan respons tersimpan.
4. **Uji penolakan**: buka DevTools → Network → cari request submit →
   hapus field `turnstileToken` (atau kirim payload tanpa token) → submit
   harus **gagal** dengan pesan *"Verifikasi keamanan belum diselesaikan."*

> Mode **Testing** Cloudflare: di dashboard Turnstile ada tombol untuk
> memaksa widget selalu lulus/gagal — berguna menguji kedua jalur tanpa
> pengguna nyata.

## Keamanan — apa yang diverifikasi & tidak

| Skenario | Aman? |
|---|---|
| Attacker hapus widget dari DOM | ❌ ditolak — token kosong |
| Attacker kirim token palsu | ❌ ditolak — Cloudflare invalid |
| Attacker replay token lama | ❌ ditolak — token sekali pakai |
| Site key dilihat publik | ✅ aman — site key memang publik |
| Secret key bocor | ⚠️ bahaya — regenerate di dashboard |
| Cloudflare down | ⚠️ submit dibiarkan lewat (by design) |

**Jangan** commit `.env`. Verifikasi tidak ada secret di bundle:
`grep TURNSTILE_SECRET_KEY .next/static` harus **kosong**.
