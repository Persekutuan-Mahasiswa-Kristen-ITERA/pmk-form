# PROGRESS — PMK Form Platform

Sumber kebenaran untuk status pekerjaan. Baca file ini, `docs/AUTHORIZATION_MATRIX.md`,
dan `git log` terlebih dulu saat melanjutkan sesi.

**Branch saat ini:** `chore/cleanup-and-hardening` (Fase 1; 16 commit, sudah di-push, **PR #3 terbuka, checks passing**)
**Diperbarui:** setelah GATE 0 — migration 002+002b SUDAH dijalankan & terverifikasi di produksi

---

## STATUS FASE

| Fase | Status | Keterangan |
|---|---|---|
| Fase 0 — verifikasi & baseline | ✅ SELESAI | tsc/eslint/build, audit RLS, snapshot data produksi |
| Fase 1 — keamanan (otorisasi) | ⏸ KODE SELESAI, ROLLOUT MENUNGGU KONFIRMASI | migration ditulis, **belum dijalankan** |
| Fase 1.5 — hardening | ✅ KODE SELESAI | rate limit, upload hardening, matriks otorisasi |
| GATE 0 | 🔄 DALAM PROSES | 002+002b ✅ ; backup DB ⏭ SKIP (ganti snapshot policy); sisanya menunggu |
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
11. **Tes 403 untuk user biasa di-skip (Opsi B)** saat GATE 0: signup publik sudah
    dimatikan + tidak ada halaman signup → hanya 1 user (admin). Validasi 403
    akan dilakukan ulang setelah **OAuth Google** (Fase 5) diaktifkan, saat sudah
    ada user non-admin sungguhan. Login admin terverifikasi = bukti 002b bekerja.

---

## MIGRATION STATUS (semua ditulis, SEMUA belum dijalankan)

| File | Status | Kapan dijalankan (rencana) |
|---|---|---|
| `002` `is_admin()` + seed | ✅ **SUDAH DIJALANKAN & TERVERIFIKASI** | Selesai GATE 0: seed super_admin `biroitpmkitera@gmail.com` |
| `002b` perbaiki recursion policy `user_roles` | ✅ **SUDAH DIJALANKAN** | Selesai GATE 0 (bersama 002) |
| `003` perketat RLS + tutup anon INSERT | ✅ **SUDAH DIJALANKAN & TERVERIFIKASI** | Selesai GATE 0 (bersama 007) |
| `004` (penanda; isinya di 003 bagian 2b) | — | Jangan dijalankan sendiri |
| `005` limit bucket storage | ⬜ belum dijalankan | Rollout langkah 10 (kapan saja, aman) |
| `006` USULAN `nim_normalized` | ⬜ usulan Fase 2/3 | Jangan dijalankan sekarang |
| `007` tabel legacy → admin only | ✅ **SUDAH DIJALANKAN & TERVERIFIKASI** | Selesai GATE 0 (bersama 003) |

**Catatan kritis 002b**: policy lama `"Super admin can manage all roles"` (FOR ALL, subquery ke
`user_roles` sendiri) menyebabkan error `42P17` pada SELECT juga → `getAdminUser()` fail-closed
untuk **semua** user → login admin mendapat 403 setelah deploy. Karena itu 002b **harus** dijalankan
bersama 002, sebelum deploy. Masalah ini lolos di Fase 0 karena `user_roles` masih kosong.

**Status 002b setelah dijalankan**: `is_admin()` sudah ada di DB, seed admin sudah ada.

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

- [x] Backup database produksi → **SKIP** (pg_dump & backup otomatis tidak bisa
      dipakai; diganti `docs/LEGACY_POLICY_SNAPSHOT.md` yang mencakup persis
      policy yang diubah 007. Data sendiri tidak dihapus oleh 007.)
- [x] Matikan signup publik — **KONFIRMASI DULU**: apakah sudah dimatikan sebelum
      deploy? (Belum dikonfirmasi user.)
- [x] Jalankan migration 002 + 002b — ✅ SELESAI & TERVERIFIKASI
      (seed `biroitpmkitera@gmail.com` = super_admin; `is_admin()` ada)
- [ ] Push branch & buat PR — ✅ SELESAI (PR #3, checks passing)
- [ ] **Cek env Vercel: `SUPABASE_SERVICE_ROLE_KEY` sudah ada?**
- [ ] Deploy (Vercel auto-build dari PR #3) → verifikasi admin masuk + user 403
      ✅ ADMIN LOGIN TERVERIFIKASI (`biroitpmkitera@gmail.com` bisa masuk dashboard
      → bukti 002b bekerja, TIDAK ADA error 42P17 di produksi).
      ⏭ TES 403 USER BIASA DI-SKIP (Opsi B) — signup publik sudah dimatikan
      (disable_signup=true) dan app tidak punya halaman signup, jadi hanya ada
      1 user (admin). Bukti tidak-ada-42P17 sudah cukup. Akan divalidasi lagi
      pasca-OAuth Google (Fase 5) saat ada user non-admin sungguhan.
- [ ] Buat form tes, uji submit E2E, tutup form tes
      ✅ SELESAI: submit E2E BERHASIL di preview PR #3 (respons
      'Febrian Yoel Anggara Saputra' masuk ke form_responses).
      ⚠️ Ternyata tes pertama dijalankan di deployment PRODUKSI (main) dan gagal
      — itu justru bukti migration 003 bekerja (anon INSERT ditolak 42501)
      karena main belum berisi server action. Kode submit baru hanya ada di
      branch, sehingga PR #3 WAJIB di-merge untuk mengembalikan kemampuan
      submit di produksi.
      🧹 SISA: 1 baris 'Test Debug' (sisipan debug) + respons E2E + form tes
      'FORM UJI E2E' perlu dihapus via dashboard admin. deleteForm akan
      cascade ke form_responses (FK on delete cascade), sehingga SEMUA respons
      tes ikut terhapus sekaligus.
      Catatan: error 400 saat saya mencoba menutup form via REST adalah salah
      teknik saya sendiri (POST diterjemahkan PostgREST sebagai INSERT),
      BUKAN bug di app — toggle/delete di dashboard memakai PATCH/DELETE
      via supabase-js dan berfungsi normal.
- [ ] Jalankan migration 003 + 007; verifikasi V1-V4
      ✅ SELESAI & TERVERIFIKASI melalui API (anon vs service role):
         - form_responses: 240 (service) vs 0 (anon) - data aman, anon diblokir
         - forms: 7 vs 0 | selection_results: 54 vs 0 | submissions: 239 vs 0
         - recruitments: 7 vs 0 (policy 'Public can view open recruitments' hilang)
         - user_roles: 1 vs 0
         - V3: anon INSERT form_responses -> HTTP 401 `42501 new row violates
           row-level security policy` ✅
- [ ] Jalankan migration 005
- [ ] Merge PR #3 ke main

---

## ISU TERBUKA

1. **Tidak ada form `is_open` di produksi** → uji submit E2E butuh form tes sementara (rollout langkah 6).
2. **7 error lint** pre-existing (`no-explicit-any` ×3, React Compiler `Date.now()` ×3, +1) — ditunda ke Fase 2.
3. **Storage INSERT anon masih terbuka** di bucket `form-attachments` (diperlukan upload publik).
   Mitigasi: migration 005 (limit ukuran + MIME). Sisa risiko: kuota abuse, belum ada rate limit upload,
   MIME palsu (stored-XSS via bucket) — rincian di `docs/AUTHORIZATION_MATRIX.md` bagian "SISA RISIKO upload".
4. **Nama policy lama `selection_results`/`submissions`/`recruitments` tidak terdokumentasi** (schema pra-001).
   Migration 007 memakai drop dinamis dari `pg_policies` + `RAISE NOTICE` agar nama tercatat.
   **SELESAI**: snapshot lengkap sudah diambil ke `docs/LEGACY_POLICY_SNAPSHOT.md`,
   sehingga rollback 007 kini LENGKAP memulihkan policy asli — tidak butuh backup DB.
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
