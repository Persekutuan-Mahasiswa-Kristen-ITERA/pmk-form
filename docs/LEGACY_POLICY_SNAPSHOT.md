# Legacy Policy Snapshot (pre-migration 007)

Definisi policy `selection_results`, `submissions`, `recruitments` pada schema
`public` SEBELUM migration 007 dijalankan. Diambil langsung dari `pg_policies`
produksi sebagai pengganti backup DB penuh (lihat `docs/PROGRESS.md`).

**Dibuat:** saat GATE 0, sebelum migration 007 dijalankan.
**Sumber:** query `select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' and tablename in
('selection_results','submissions','recruitments')`.

Dengan snapshot ini, rollback migration 007 menjadi **lengkap dan dapat
dipulihkan persis seperti semula** — tidak butuh backup DB seluruhnya.

---

## recruitments

| policyname | cmd | roles | qual | with_check |
|---|---|---|---|---|
| Admins can delete recruitments | DELETE | {authenticated} | true | null |
| Admins can insert recruitments | INSERT | {authenticated} | null | true |
| Admins can update recruitments | UPDATE | {authenticated} | true | true |
| Admins can view all recruitments | SELECT | {authenticated} | true | null |
| Public can view open recruitments | SELECT | {public} | (is_open = true) | null |

## selection_results

| policyname | cmd | roles | qual | with_check |
|---|---|---|---|---|
| Admins can manage selection results | ALL | {authenticated} | true | true |

## submissions

| policyname | cmd | roles | qual | with_check |
|---|---|---|---|---|
| Admins can delete submissions | DELETE | {authenticated} | true | null |
| Admins can update submissions | UPDATE | {authenticated} | true | true |
| Admins can view submissions | SELECT | {authenticated} | true | null |
| Public can submit applications | INSERT | {anon,authenticated} | null | true |

---

## Verifikasi dampak sebelum 007 dijalankan

Sudah dicek terhadap kode (GATE 0):

- `submissions` **hanya dibaca** oleh `app/api/cek-hasil/route.ts` via
  **service role** (bypass RLS) -> tetap berfungsi setelah 007.
- `recruitments` **tidak diakses kode sama sekali** (data sudah dimigrasi ke
  `forms`).
- Tidak ada kode yang melakukan INSERT ke `submissions` -> policy publik
  "Public can submit applications" yang akan dihapus sudah **yatim (0 pemanggil)**.
- Tidak ada route `/recruitment/[slug]` di kode (klaim dokumen lama salah).

Kesimpulan: menghapus policy publik di atas **aman**, dan menghapus policy
`using (true)` untuk authenticated memperketat akses sesuai tujuan Fase 1.
