# Panduan Deployment — PMK Form Platform

> Disinkronkan ulang Fase 4D. Versi lama dokumen ini menyebut repo `pmk-oprec`
> dan melewatkan env wajib server — keduanya sudah diperbaiki.

## 1. Arsitektur singkat

- **Frontend + Server Actions**: Next.js App Router, di-deploy ke **Vercel**
  (project `pmk-form`).
- **Backend**: Supabase Postgres + Auth + Storage (project
  `ftmtealtnbwheduvuyem`).
- **Otorisasi**: default-deny. Halaman `/admin/*` memakai `requireAdmin()`;
  submit publik memakai **service-role client** (bypass RLS secara sengaja,
  divalidasi Zod server-side + rate limit).

## 2. Environment variables (WAJIB)

Set di **Vercel Dashboard → Project → Settings → Environment Variables**.
Lihat `.env.example` untuk template lengkap.

| Variabel | Wajib | Keterangan |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key (aman di browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Server saja, JANGAN pernah expose ke browser.** Dipakai submit publik, cek-hasil, dan query admin. |
| `TRUSTED_PROXY` | ⚠️ | `vercel` (default bila kosong), `cloudflare`, `nginx`, atau `none` (dev lokal saja). Salah set = IP rate-limit bisa di-spoof. |

Verifikasi tidak bocor setelah build:

```bash
grep -r SUPABASE_SERVICE_ROLE_KEY .next/static || echo "aman: tidak ada di bundle client"
```

## 3. Urutan rollout (setiap rilis yang memuat migration)

1. **Backup / snapshot**: lihat `docs/BACKUP_PROCEDURE.md` (prosedur backup
   lengkap + matriks apa yang bisa dipulihkan). Kebijakan RLS snapshot →
   `docs/LEGACY_POLICY_SNAPSHOT.md`; data tidak disentuh migration
   (prinsip non-destruktif sejak Fase 0).
2. **Jalankan migration** di Supabase **SQL Editor**, sesuai nomor urut di
   `migrations/`. Setiap file mencantumkan cara run + rollback-nya sendiri.
   Status migration yang sudah live: 002, 002b, 003, 005, 007, 008, 010, 011, 012.
3. **Merge PR → Vercel auto-deploy** dari `main`.
4. **Verifikasi pasca-deploy**:
   - Landing `/` memuat (form aktif tampil).
   - Submit 1 respons tes di form uji → `/success`.
   - Login `/admin/login` → dashboard → viewer respons.
   - `/hasil` dengan NIM+email uji.

## 4. Opsi VPS / Docker (non-utama)

Project ini dioperasikan di Vercel. Opsi di bawah TIDAK diuji rutin —
dicantumkan agar tidak menghalangi bila kelak pindah platform.

- **VPS (PM2)**: Node 18+, `npm install`, isi `.env` (4 var di atas),
  `npm run build`, `pm2 start npm --name pmk-form -- start`.
  Pastikan reverse proxy menulis header IP yang benar dan `TRUSTED_PROXY`
  diset sesuai (`nginx`/`none`).
- **Docker**: tidak ada `Dockerfile` di repo — buat sendiri bila dibutuhkan,
  pastikan secret di-pass sebagai env runtime (bukan baked ke image).

## 5. Rollback

- **Kode**: revert merge commit di GitHub → Vercel redeploy otomatis.
- **Migration**: setiap file `migrations/*.sql` mencantumkan blok ROLLBACK.
  Migration 007 (RLS legacy) dan 008 (index NIM) aman di-rollback tanpa
  kehilangan data (hanya policy/index, bukan baris data).
