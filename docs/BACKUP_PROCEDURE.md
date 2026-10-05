# Prosedur Backup & Pemulihan — PMK Form Platform

**Versi:** Fase 7 item 7 · **Terakhir diperbarui:** sesuai branch `docs/backup-prosedur`

Dokumen ini menjelaskan apa yang perlu (dan tidak perlu) di-backup, seberapa
sering, dan cara memverifikasi backup benar-benar bisa dipulihkan.

---

## TL;DR (urutan prioritas)

| # | Apa | Seberapa sering | Cara restore | Hati-hati |
|---|---|---|---|---|
| 1 | **Kode + migration** | Setiap commit | `git checkout` + jalankan migration | Rollback migration butuh SQL terbalik (ada tiap file) |
| 2 | **Env var (Vercel + Supabase)** | Sekali + tiap perubahan | Lihat `DEPLOYMENT.md` + `.env.example` | Service role key = akses penuh, jangan sampai hilang |
| 3 | **`sheets_config` per form** | Tidak perlu — ada di DB | — | Spreadsheet itu milik admin, bukan app |
| 4 | **Backup DB penuh** | — | — | **SKIP, lihat catatan di bawah** |

---

## 1. Kenapa backup DB penuh di-skip (kejujuran teknis)

Paket Supabase saat ini **(Free/Pro)**:

- **Free**: tidak ada automated backup. Tidak ada point-in-time recovery.
- **Pro**: automated backup harian + 7-day point-in-time recovery. Tapi
  **hanya DB**, **tidak** Storage.

### Apa yang menggantikan backup DB penuh?

Karena semua perubahan schema di proyek ini **non-destruktif** (lihat aturan
migration di bawah), kita tidak butuh snapshot DB seluruhnya untuk pulih dari
kesalahan migration:

1. **Kolom hanya ditambah, tidak di-drop.** Contoh: migration 011
   (`form_responses.status`), 013 (`forms.is_deleted`). Rollback = drop kolom
   baru — aman, data lama utuh.
2. **Data legacy TIDAK pernah dihapus.** Contoh: `selection_results` (54 baris)
   hanya **dipensiunkan dari aplikasi** (Fase 7-3), tabel tetap ada. Snapshot
   policy-nya ada di `docs/LEGACY_POLICY_SNAPSHOT.md`.
3. **Soft delete, bukan hard delete.** Form berisi respons tidak bisa
   di-hard-delete (Fase 4C + 7-6) — hanya disembunyikan (`is_deleted=true`).
4. **Audit log append-only.** Tidak ada policy UPDATE/DELETE di
   `admin_audit_log`, jadi jejak aksi admin tidak bisa hilang "tanpa jejak".

> **Bila Anda butuh backup DB penuh:** upgrade Supabase ke Pro, atau export
> manual berkala (lihat §5). Keputusan ini **ditunda** karena data saat ini
> kecil (8 forms, 240+ responses) dan migration selalu reversible.

---

## 2. Yang WAJIB di-backup (dan sudah otomatis)

### 2a. Kode + migration → di Git (otomatis)

Setiap commit ke `main` lewat PR. **Ini adalah backup utama.**

Struktur:

```
migrations/          ← 13 file SQL, urut, masing-masing ada bagian ROLLBACK
docs/                ← dokumentasi + snapshot policy
```

**Aturan migration (dipatuhi dari Fase 0):**

- Non-destruktif: hanya tambah/komentar/index/policy.
- Tidak ada `drop table`, tidak ada `delete from`, tidak ada `alter ... drop`
  terhadap kolom yang ada datanya.
- Setiap file punya bagian **VERIFIKASI PASCA-MIGRATION** (query read-only)
  dan **ROLLBACK** (SQL terbalik yang aman).

**Cara pulih:** `git checkout <commit-sebelum-masalah>` + jalankan SQL di
bagian ROLLBACK migration yang bermasalah.

### 2b. Env var → Vercel Dashboard (semi-otomatis)

Lihat daftar lengkap di `.env.example`. Yang kritis:

| Env | Kenapa kritis |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Akses penuh bypass RLS. Hilang = tidak bisa submit form. |
| `GOOGLE_PRIVATE_KEY` | Sheets sync berhenti total. Regenerasi butuh tutorial `docs/SHEETS_SERVICE_ACCOUNT_TUTORIAL.md`. |
| `CRON_SECRET` | Cron Sheets sync gagal authenticate. |
| `TURNSTILE_SECRET_KEY` | Verifikasi anti-bot gagal → submit publik ditolak. |

**Cara backup:** Vercel Dashboard → Project → Settings → Environment Variables.
Snapshot manual ke password manager (1 file `.env`, **jangan** commit ke git).

> **Hindari** backup env lewat repo. `.gitignore` sudah mengabaikan `.env`.
> Bila terlanjur commit: rotasi key di dashboard masing-masing, lalu
> `git rm --cached .env` + commit.

---

## 3. Prosedur backup berkala (manual, gratis)

### 3a. Setiap bulan — verifikasi kesehatan DB

Jalankan di Supabase SQL Editor (read-only, aman):

```sql
-- Jumlah data per tabel (pastikan tidak ada yang "hilang" mendadak)
select 'forms' as t, count(*) from public.forms
union all select 'form_responses', count(*) from public.form_responses
union all select 'admin_members', count(*) from public.admin_members
union all select 'admin_audit_log', count(*) from public.admin_audit_log
union all select 'sheets_outbox', count(*) from public.sheets_outbox;

-- Pastikan tidak ada form yang "tiba-tiba terhapus" tanpa sengaja
select count(*) filter (where is_deleted) as sampah,
       count(*) filter (where not is_deleted) as aktif
from public.forms;

-- Respons yang belum tersinkron ke Sheets (harus kecil / 0)
select status, count(*) from public.sheets_outbox group by status;
```

**Catat hasilnya** di ticket/notion. Bila angka turun drastis dari bulan lalu
tanpa alasan jelas → investigasi.

### 3b. Setiap 3 bulan — export manual (opsional, gratis)

```bash
# Di Supabase Dashboard → Database → Backup → Download backup (.sql)
# ATAU via pg_dump bila punya connection string:
pg_dump "$DATABASE_URL" --schema=public --no-owner --no-privileges \
  --file="pmk-backup-$(date +%Y%m%d).sql"
```

**Verifikasi backup bisa dipulihkan** (penting — backup yang belum dites =
bukan backup):

```bash
# Restore ke DB lokal (docker), lalu cek
docker run -d --name restore-test -e POSTGRES_PASSWORD=pw postgres:17
# ... import, lalu jalankan query §3a untuk bandingkan angka
```

**Simpan:** 3 backup terakhir (rolling). Lokasi: lokal admin + 1 copy cloud
(Google Drive/Dropbox gratis sudah cukup).

---

## 4. Prosedur pemulihan (playbook)

### 4a. Kasus: migration merusak data (mis. salah jalankan SQL)

1. **JANGAN panik, jangan jalankan migration lain dulu.**
2. Buka file migration yang bermasalah → bagian **ROLLBACK**.
3. Baca catatan jujur di bagian ROLLBACK — beberapa rollback ada konsekuensi
   (mis. rollback 013 membuat form "keluar dari sampah").
4. Jalankan SQL rollback di Supabase SQL Editor.
5. Jalankan query verifikasi (bagian VERIFIKASI PASCA-MIGRATION di file
   migration sebelumnya) untuk pastikan data utuh.

### 4b. Kasus: deploy merusak aplikasi

1. Vercel Dashboard → Deployments → **Rollback** ke deploy sebelumnya.
   (Vercel simpan history deploy, ini hitungan menit.)
2. Bila masalah dari kode: revert PR lewat GitHub (buka PR → Revert).
3. Bila masalah dari env: perbaiki env → **Redeploy** (perubahan env saja
   tidak memicu deploy otomatis).

### 4c. Kasus: form publik error mendadak

Urutan cek (paling sering dulu):

1. **Env hilang/kedaluwarsa** — cek Vercel env (terutama
   `SUPABASE_SERVICE_ROLE_KEY`). Tanda: error di log Vercel.
2. **Form di-soft-delete tanpa sengaja** — cek `select * from forms where
   is_deleted` atau halaman `/admin/forms/trash`, kembalikan kalau perlu.
3. **Form ditutup** — toggle via dashboard (bisa tanpa deploy).
4. **Turnstile bermasalah** — widget fail-open bila Cloudflare down, tapi
   token kosong tetap ditolak. Cek status Cloudflare.

### 4d. Kasus: data Supabase hilang total (worst case)

Tanpa backup Pro, sisa sumber pemulihan (urut):

1. **Vercel** — tidak simpan data, hanya kode. Tidak membantu.
2. **Google Sheets** — **ini backup data de facto**. `sheets_outbox` +
   cron harian sinkron respons ke spreadsheet admin. Bila spreadsheet aktif,
   respons terbaru ada di sana (kolom `__response_id` = id `form_responses`).
3. **Lampiran file** — ada di Supabase Storage bucket `form-attachments`.
   **Storage TIDAK di-backup oleh Supabase Pro pun.** Bila Storage hilang,
   lampiran hilang permanen. Spreadsheet hanya simpan URL, bukan isinya.
4. **`git`** — hanya struktur + migration, bukan data.

> **Implikasi jujur:** seandainya DB hilang, respons bisa direkonstruksi
> **sebagian** dari Sheets, tapi **lampiran file tidak bisa**. Itu alasan
> kuat untuk upgrade Supabase Pro bila data lampiran makin banyak.

---

## 5. Matriks: apa yang bisa dan tidak bisa dipulihkan

| Data | Bisa dipulihkan? | Dari mana | Catatan |
|---|---|---|---|
| Kode + migration | ✅ Penuh | Git | Commit + PR history |
| Env var | ✅ Penuh | Vercel Dashboard | Simpan ke password manager |
| Policy RLS | ✅ Penuh | Git + `docs/LEGACY_POLICY_SNAPSHOT.md` | Snapshot untuk tabel legacy |
| `forms` (judul, fields, settings) | ⚠️ Sampai backup terakhir | Manual export §3b | Atau rekonstruksi dari `sheets_config` + ingatan admin |
| `form_responses` (jawaban) | ⚠️ Sampai sinkron Sheets terakhir | Spreadsheet admin | Lihat §4d — ini **backup de facto** |
| **Lampiran file (Storage)** | ❌ **Tidak bisa** | — | Storage tidak ada backup gratis. **Risiko terbesar.** |
| `admin_audit_log` | ❌ Tidak bisa | Append-only, tidak ada copy | Jejak aksi admin hilang |
| `user_roles` / auth | ⚠️ Sampai backup terakhir | Supabase Auth (dashboard) | Email akun admin |

---

## 6. Rekomendasi ke depan (saat data bertumbuh)

Urut berdasarkan risiko vs biaya:

1. **[MURAH, SEKARANG] Sinkron Sheets aktif untuk semua form penting.**
   Sudah jalan. Pastikan spreadsheet admin tidak terhapus dan service account
   masih punya akses Editor.
2. **[MURAH] Export manual 3 bulanan** (§3b) + simpan 3 rolling copy.
3. **[Rp ~$25/bln] Supabase Pro** — automated backup harian + 7-day PITR
   untuk DB. **Tidak** cover Storage.
4. **[MENENGAH] Export Storage berkala** — script download semua file di
   bucket `form-attachments` ke cloud storage lain. Belum dibuat; bikin saat
   lampiran melebihi ~500 file.
5. **[MENENGAH] Sentry monitoring** — deteksi error submit mendadak
   (Fase 7 item 8, butuh akun).

---

## 7. Checklist pasca-incident (setelah pulih)

- [ ] Data utuh? Jalankan query §3a, bandingkan dengan catatan terakhir.
- [ ] Form publik bisa di-submit? Tes 1 submit end-to-end (form uji, bukan
      form produksi yang punya data asli).
- [ ] Sheets sync jalan? Cek `sheets_outbox` tidak menumpuk `pending`.
- [ ] Audit log mencatat aksi pemulihan? (mis. restore form via sampah
      tercatat sebagai `form_update`).
- [ ] Catat incident di `docs/PROGRESS.md` — apa yang terjadi, kenapa,
      bagaimana mencegah.

---

## 8. Tautan terkait

- `DEPLOYMENT.md` — cara deploy + env var lengkap
- `docs/PROGRESS.md` — riwayat setiap fase + rollout
- `docs/LEGACY_POLICY_SNAPSHOT.md` — snapshot policy RLS tabel legacy
- `docs/SHEETS_SETUP.md` — setup sinkron Sheets (backup data de facto)
- `docs/SHEETS_SERVICE_ACCOUNT_TUTORIAL.md` — cara regenerasi kredensial Google
- `docs/TURNSTILE_SETUP.md` — setup & troubleshooting Turnstile
- Setiap file `migrations/0XX_*.sql` — bagian VERIFIKASI + ROLLBACK
