# PROGRESS — PMK Form Platform

Sumber kebenaran untuk status pekerjaan. Baca file ini, `docs/AUTHORIZATION_MATRIX.md`,
dan `git log` terlebih dulu saat melanjutkan sesi.

**Branch saat ini:** `chore/cleanup-and-hardening` (Fase 1; 14 commit, belum di-merge ke main)
**Diperbarui:** setelah Checkpoint 3 putaran 3 (commit `fe1bf52`)

---

## STATUS FASE

| Fase | Status | Keterangan |
|---|---|---|
| Fase 0 — verifikasi & baseline | ✅ SELESAI | tsc/eslint/build, audit RLS, snapshot data produksi |
| Fase 1 — keamanan (otorisasi) | ⏸ KODE SELESAI, ROLLOUT MENUNGGU KONFIRMASI | migration ditulis, **belum dijalankan** |
| Fase 1.5 — hardening | ✅ KODE SELESAI | rate limit, upload hardening, matriks otorisasi |
| GATE 0 | 🛑 MENUNGGU | checklist rollout Fase 1 belum dikonfirmasi |
| Fase 2 — pembersihan redundansi | ⬜ BELUM MULAI | branch `chore/cleanup-redundancy` (dibuat setelah GATE 0) |
| Fase 3 — enforce form config | ⬜ BELUM MULAI | |
| Fase 4 — keputusan strategis | ⬜ BELUM MULAI | |
| Fase 5 — OAuth Google + admin | ⬜ BELUM MULAI | |
| Fase 6 — Google Sheets | ⬜ BELUM MULAI | |
| Fase 7 — opsional | ⬜ BELUM MULAI | |

---

## KEPUTUSAN YANG SUDAH DISETUJUI

1. **Admin default-deny via `user_roles`**: user terautentikasi tanpa baris `user_roles` = tidak ada akses
   admin. Opsi 1 (`user_roles` + `requireAdmin()`) dipilih. Enforcement per-divisi ditunda ke Fase 4.
2. **`is_admin()` SECURITY DEFINER** dengan `SET search_path = public`; REVOKE dari `public`/`anon`,
   GRANT hanya ke `authenticated`. Catatan teknis: fungsi ini **mem-bypass RLS** karena dieksekusi
   sebagai owner — bukan "dievaluasi lewat RLS".
3. **Submit via server action + service role**: `submitFormResponseAction` memvalidasi
   (form terbuka/close_date/max_responses/duplikat NIM/skema Zod) lalu insert via service role.
4. **Viewer toleran key**: `resolveAnswer()` membaca `answers[field.id] ?? answers[field.label]`
   supaya data lama (key=label) & baru (key=id) tampil tanpa remap data produksi.
5. **Normalisasi string-option DIPERTAHANKAN**: data produksi memakai `string[]` untuk opsi;
   jangan hapus pemetaan itu di `toRendererConfig()`.
6. **Renderer baca `helpText ?? helperText`** (11 helper text produksi memakai `helperText`).
7. **Migration 006 hanya usulan** untuk Fase 2/3 (kolom `nim_normalized` + unique PARTIAL index).
   **Data lama TIDAK disentuh** (5 pasang duplikat NIM dibiarkan).
8. **Migration 004 digabung ke 003** (bagian 2b); file 004 menjadi penanda.
9. **`getClientIp()` env-aware**: `TRUSTED_PROXY=vercel|cloudflare|nginx|none`, default `vercel`,
   fail-safe ke `vercel` bila nilai tak dikenal. Fallback selalu elemen **terakhir** `x-forwarded-for`
   (anti spoofing).
10. **Platform deployment: Vercel.**

---

## MIGRATION STATUS (semua ditulis, SEMUA belum dijalankan)

| File | Status | Kapan dijalankan (rencana) |
|---|---|---|
| `002` `is_admin()` + seed | ⬜ belum dijalankan | Rollout langkah 3 (bersama 002b, sebelum deploy) |
| `002b` perbaiki recursion policy `user_roles` | ⬜ belum dijalankan | Rollout langkah 3 — **WAJIB sebelum deploy** |
| `003` perketat RLS + tutup anon INSERT | ⬜ belum dijalankan | Rollout langkah 7 (setelah deploy + verifikasi) |
| `004` (penanda; isinya di 003 bagian 2b) | — | Jangan dijalankan sendiri |
| `005` limit bucket storage | ⬜ belum dijalankan | Rollout langkah 10 (kapan saja, aman) |
| `006` USULAN `nim_normalized` | ⬜ usulan Fase 2/3 | Jangan dijalankan sekarang |
| `007` tabel legacy → admin only | ⬜ belum dijalankan | Rollout langkah 7 (bersama 003) |

**Catatan kritis 002b**: policy lama `"Super admin can manage all roles"` (FOR ALL, subquery ke
`user_roles` sendiri) menyebabkan error `42P17` pada SELECT juga → `getAdminUser()` fail-closed
untuk **semua** user → login admin mendapat 403 setelah deploy. Karena itu 002b **harus** dijalankan
bersama 002, sebelum deploy. Masalah ini lolos di Fase 0 karena `user_roles` masih kosong.

---

## ROLLOUT FASE 1 (11 langkah — urutan WAJIB)

1. Backup DB (WAJIB — 007 tidak bisa rollback tanpa backup)
2. Matikan signup publik (Supabase Dashboard → Authentication)
3. Jalankan **migration 002 + 002b** bersamaan → cek `RAISE NOTICE "SEED ADMIN OK"`; berhenti jika gagal
4. Deploy kode Fase 1
5. Verifikasi: admin masuk `/admin/dashboard`; user biasa → 403 (bukti 002b bekerja, no `42P17`)
6. **Buat form tes sementara** (`is_open=true`, close +1 jam) — semua form produksi tertutup
7. Jalankan **migration 003 + 007** satu sesi; uji submit form tes (wajib sukses sebelum lanjut)
8. Verifikasi V1–V4 (lihat file 003)
9. Tutup/hapus form tes
10. Jalankan **migration 005**
11. Signup publik: hidupkan hanya jika perlu

---

## LANGKAH MANUAL YANG MENUNGGU

- [ ] Backup database produksi
- [ ] Matikan signup publik
- [ ] Jalankan migration 002 + 002b; konfirmasi "SEED ADMIN OK"
- [ ] Deploy branch `chore/cleanup-and-hardening`
- [ ] Verifikasi admin/user biasa
- [ ] Buat form tes, uji submit E2E, tutup form tes
- [ ] Jalankan migration 003 + 007; verifikasi V1–V4
- [ ] Jalankan migration 005
- [ ] Merge `chore/cleanup-and-hardening` ke main (GATE 0)
- [ ] Set env produksi: `SUPABASE_SERVICE_ROLE_KEY`, `TRUSTED_PROXY=vercel`

---

## ISU TERBUKA

1. **Tidak ada form `is_open` di produksi** → uji submit E2E butuh form tes sementara (rollout langkah 6).
2. **7 error lint** pre-existing (`no-explicit-any` ×3, React Compiler `Date.now()` ×3, +1) — ditunda ke Fase 2.
3. **Storage INSERT anon masih terbuka** di bucket `form-attachments` (diperlukan upload publik).
   Mitigasi: migration 005 (limit ukuran + MIME). Sisa risiko: kuota abuse, belum ada rate limit upload,
   MIME palsu (stored-XSS via bucket) — rincian di `docs/AUTHORIZATION_MATRIX.md` bagian "SISA RISIKO upload".
4. **Nama policy lama `selection_results`/`submissions`/`recruitments` tidak terdokumentasi** (schema pra-001).
   Migration 007 memakai drop dinamis dari `pg_policies` + `RAISE NOTICE` agar nama tercatat.
   Rollback 007 jujur: policy lama tidak bisa dipulihkan tanpa backup.
5. **`getAdminUser()`/`requireAdmin()` belum dibungkus React `cache()`** — dijadwalkan Fase 2 langkah 7.
6. **Email admin seed**: `biroitpmkitera@gmail.com` (migration 002, RAISE EXCEPTION jika tak ditemukan).

---

## SARAN (catatan, jangan dikerjakan sebelum disetujui)

- Rate limit upload action (`uploadFormAttachment`) — lihat Fase 2 langkah 8.
- Cek header response bucket (`Content-Type`/`Content-Disposition`) untuk mitigasi stored-XSS — Fase 7.
- `nim_normalized` + unique index — Fase 3 (dari usulan migration 006).
- Manajemen admin via allowlist `admin_members` — Fase 5.

---

## PRODUKSI (snapshot Fase 0, untuk konteks)

- 7 forms (semua `form_type=recruitment`, `is_open=false`)
- 240 `form_responses` (239 migrasi + 1 baru), 239 punya key `field_applicant_nim`
- `user_roles` = 0 baris; `selection_results` = 54 baris
- Signup publik aktif (`disable_signup: false`) — **harus dimatikan saat rollout**
- Tidak ada route `/recruitment/[slug]` atau `/admin/recruitments` (klaim dokumen lama salah)
