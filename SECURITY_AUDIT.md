# Security & Performance Audit — pmk-form (form.pmkitera.web.id)

Tanggal: 2026-10-09 · Branch: chore/ui-qa · Commit dasar: bd82059

## 1. Metode Pengujian

| Kategori | Tool | Hasil |
|---|---|---|
| Build | `npm run build` | ✅ sukses, 0 error |
| Unit test | `npm run test:unit` | ✅ 69/69 lulus |
| TypeScript strict | `tsc --noEmit` | ✅ 0 error |
| Live headers | `curl -I https://form.pmkitera.web.id` | ✅ HTTP/2, HSTS, CSP, nosniff |
| Open redirect | `/auth/callback?next=//evil.com` dsb. | ✅ Dinetralkan ke `/admin/dashboard` |
| Cron tanpa secret | `GET/POST /api/cron/sheets-sync` | ✅ 401 |
| Admin tanpa sesi | `/admin/*` | ✅ Redirect ke `/admin/login` |
| RLS Supabase (anon) | SELECT/INSERT `form_responses`, `admin_members`, `admin_audit_log` | ✅ Semua ditolak RLS |
| **Column leak `forms`** | ANON `SELECT sheets_config` | ❌ **BOCOR** (lihat S2) |
| Perf live | PerformanceAPI browser | FCP 2.4s, 297 KB JS, 461 KB total |

## 2. Temuan & Perbaikan

### S1 — Kritis: Kebocoran `spreadsheet_id` Google Sheets
- **Bukti**: `GET /rest/v1/forms?select=sheets_config` pakai anon key mengembalikan `{"enabled":true,"sheet_name":"Sheet1","spreadsheet_id":"1gpygvz7g70X54MHusyUKHHSGxfYfqV7ukepOQDBZw9g"}`.
- **Akar**: Postgres RLS mengatur baris, bukan kolom. Policy `Public can view open forms` membuka *semua* kolom form yang is_open=1.
- **Fix**:
  - `migrations/014_restrict_public_form_columns.sql` → `REVOKE SELECT (created_by, sheets_config) ON public.forms FROM anon` + `GRANT SELECT` kolom publik. **Wajib di-apply ke DB produksi.**
  - `lib/forms.ts` → ganti `select("*")` menjadi allow-list eksplisit di `getActiveForms()` dan `getFormBySlug()`.

### S2 — Potensi Open Redirect Pasca-Submit
- `GenericFormRenderer` memakai `router.push(settings.redirect_url)` tanpa validasi.
- **Fix**: terima hanya path `startsWith("/")`, bukan `//`, tanpa `:`.

### S3 — Fail-Open pada Pengecekan Duplikat Respons
- `hasDuplicateResponse()` sebelumnya `return false` saat error DB → membiarkan spam submit.
- **Fix**: `throw` error retryable.

### S4 — Validasi Bulk Status Tidak Lengkap
- `bulkUpdateStatusAction` tidak membatasi jumlah & tipe ID.
- **Fix**: batasi ≤500 item + validasi UUID per item.

### S5 — Hardening Header & CSP
- `next.config.mjs`:
  - `poweredByHeader: false` (hilangkan `X-Powered-By`).
  - CSP `script-src`: hapus `'unsafe-eval'`.

### S6 — Inkonsistensi Gating Form
- `/form/[slug]` hanya cek `is_open && !expired`, mengabaikan `open_date` → form masa depan bisa diisi lebih awal.
- **Fix**: pakai `isFormActive()` (satu sumber kebenaran dengan landing/submit).

## 3. Analisis Performa

### Baseline live
- First Contentful Paint: **2.4 s**
- Total transfer initial: **461 KB** (JS 297 KB, font 85 KB, img 62 KB, CSS 11 KB)
- Largest JS chunk: 73 KB

### Penyebab berat JS
- `framer-motion` di-load di landing untuk dekorasi `GoldenParticles` (≈35–45 KB gzip).
- `lucide-react` 46 MB di node_modules (sudah tree-shaken, tapi perhatian saat tambah ikon).
- 39 chunks (over-splitting potensial — dioptimalkan Next.js, bukan masalah akut).

### Perbaikan
- `GoldenParticles.tsx` ditulis ulang pakai **CSS keyframes murni** (compositor-thread, 0 JS/frame).
- `useReducedMotion` diganti `matchMedia('(prefers-reduced-motion: reduce)')` native.
- Verifikasi: `grep -r "framer-motion" .next/static/chunks → 0 hit`.

### Hasil
- Bundle client chunks: **1.7 MB** (dari 1.8 MB).
- Jalur publik: framer-motion hilang dari initial bundle landing/form (~35–45 KB gzip pulih).
- Animasi partikel berjalan di GPU compositor.

## 4. Sisa Temuan (bukan blockers)

### Dev-tooling vulnerabilities (9: 7 high, 2 moderate)
Semua di `devDependencies`/transitif — **tidak ada yang sampai ke runtime produksi**:
| Paket | Severity | Jalur | Catatan |
|---|---|---|---|
| tailwindcss | high | devDeps → chokidar/braces/micromatch/fast-glob/postcss-* | Upgrade ke v4 = breaking change besar (postponed) |
| braces | high | transitif via chokidar | stack exhaustion DoS — hanya build-time |
| postcss-selector-parser | moderate | transitif via postcss-nested | CPU exhaustion — hanya build-time |
| eslint-config-next, @next/eslint-plugin-next, chokidar, micromatch, fast-glob, postcss-nested | high/moderate | devDeps | Perlu `npm audit fix --force` (breaking) |

Production-only audit (`npm audit --omit=dev`): hanya `postcss-selector-parser` transitif dari build pipeline, **bukan runtime**.

## 5. Rekomendasi Tindakan Lanjut

1. ✅ **Apply migrasi 014** ke Supabase produksi (sudah di SQL file).
2. ⚠️ **Rotasi `spreadsheet_id`** bila form memegang data sensitif (ID sudah tersebar).
3. ⚠️ **Rotasi Google service account** bila ada kecurigaan.
4. 📋 Upgrade Tailwind v3 → v4 + `npm audit fix --force` di task terpisah (butuh regression test UI).
5. 📋 Pertimbangkan `next/dynamic` untuk dnd-kit / chart admin agar tidak masuk bundle publik.
6. 📋 `next/font` + preload kritikal untuk tekan 85 KB font.

## 6. File yang Dimodifikasi (commit bd82059)

```
app/actions/responseStatus.ts        bulk validation
app/form/[slug]/page.tsx             gating isFormActive
app/globals.css                      keyframes partikel
components/GenericFormRenderer.tsx   anti open-redirect
components/GoldenParticles.tsx       CSS keyframes (bukan framer-motion)
lib/forms.ts                         allow-list kolom + fail-closed
next.config.mjs                      CSP + poweredByHeader
migrations/014_restrict_public_form_columns.sql  (BARU — wajib di-apply)
```
