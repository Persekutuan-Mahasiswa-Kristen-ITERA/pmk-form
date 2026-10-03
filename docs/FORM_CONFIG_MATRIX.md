# Form Config Matrix

Status setiap fitur form: **ditawarkan builder?** → **dipakai renderer?** →
**dienforce server?**. Sumber kebenulan untuk Fase 3 (`docs/prompts/MASTER.md`).

Dibuat dengan mengaudit kode per lokasi (builder = `components/GenericFormBuilder.tsx`,
renderer = `GenericFormRenderer.tsx` + `FormFieldRenderer.tsx`, server =
`app/actions/submitResponse.ts` + `lib/form-schema.ts`).

**Aturan Fase 3**: fitur yang DITAWARKAN builder wajib bekerja end-to-end
(renderer + validasi server dari satu sumber schema). Fitur yang tidak ditawarkan
dan tidak dipakai: hapus dari type atau tandai "belum didukung".

---

## RINGKASAN STATUS

| Fitur | Builder | Renderer | Server | Status Fase 3 |
|---|---|---|---|---|
| `collect_identity` | ✅ toggle | ❌ | ❌ | 🔴 **BROKEN** — implementasi (F3-2a) |
| `validation` (field) | ❌ | ❌ | ⚠️ parsial | 🔴 implementasi (F3-2c) |
| `max_responses` | ❌ | — | ✅ | 🟢 sudah enforce |
| `allowed_angkatan` | ✅ | ❌ | ❌ | 🔴 implementasi atau hapus (F3-2c) |
| `redirect_url` | ❌ | ❌ | ❌ | ⚫ tidak ditawarkan → hapus dari type |
| `show_progress` | ❌ | ❌ | ❌ | ⚫ tidak ditawarkan → hapus dari type |
| `require_login` | ❌ | ❌ | ❌ | ⚫ tidak ditawarkan → hapus dari type |
| `thank_you_message` | ✅ | ✅ (success) | — | 🟢 OK |
| `wa_group_link` | ✅ | ✅ (success) | — | 🟢 OK |
| `open_date` | ❌ | — | ❌ | 🟡 dipakai `isFormActive` saja |
| `visibleIf` (field) | ❌ | ❌ | ❌ | ⚫ tidak ditawarkan → lihat keputusan |

---

## DETAIL PER FITUR

### `collect_identity` 🔴 BROKEN — prioritas tertinggi

**Dampak produksi**: 7 dari 8 form produksi `collect_identity: true`. Admin
mengaktifkan toggle "Kumpulkan Identitas Otomatis (Nama/NIM/Email/Prodi)"
(**`GenericFormBuilder.tsx:306`**) tapi:

- renderer **tidak membaca** setting ini → field identitas tidak dimunculkan
- `buildFormSchema` **tidak menghasilkan** field identitas
- `submitResponse` **tidak menyimpan** identitas otomatis

Konsekuensi: form baru yang seharusnya mengumpulkan identitas **tidak
mengumpulkan apa pun**. Admin tidak sadar.

**Data lama**: 240 respons pra-migrasi mempunyai `field_applicant_nim`,
`field_applicant_name`, `field_applicant_email` — disisipkan sistem lama,
bukan dari fitur ini.

**Rencana (F3-2a)**: saat render + submit, jika `collect_identity` true,
suntikkan field identitas (Nama/NIM/Email/Prodi) sebagai field wajib dengan
id stabil (`field_applicant_name`, `field_applicant_nim`,
`field_applicant_email`, `field_applicant_prodi`). Sinkron dengan pengecekan
duplikat NIM di `submitResponse.ts:114`.

### `validation` (minLength/maxLength/pattern) 🔴

- **Builder**: tidak ada UI untuk mengatur validation
- **Renderer**: tidak menerapkan
- **Server** (`lib/form-schema.ts`): hanya sebagian — cek `buildFormSchema`

**Rencana (F3-2c)**: implementasi `minLength`/`maxLength`/`pattern` di
`buildFormSchema` (satu sumber, dipakai client + server). Pattern dari
builder belum ada UI → minimal server sudah siap, UI tambah jika diminta.

### `max_responses` 🟢

**Server** (`submitResponse.ts` langkah 3): sudah enforce dengan count check.
Builder belum ada UI → admin atur manual via SQL. OK untuk sekarang.

### `allowed_angkatan` 🔴

**Builder** ada UI (input angkatan, baris 300-an). **Renderer + server: tidak
ada pengecekan** → angkatan diisi bebas meskipun dibatasi.

**Rencana (F3-2c)**: butuh field Angkatan + pengecekan server. Karena field
Angkatan tidak otomatis (tidak ada di `collect_identity`), ini butuh
**keputusan**: tambahkan ke identitas otomatis atau biarkan sebagai field biasa
dengan validasi manual. Default: validasi server berlaku HANYA jika form
memiliki field Angkatan (id `field_applicant_angkatan`), jangan hardcode.

### `redirect_url` / `show_progress` / `require_login` ⚫

Dideklarasikan di `FormSettings` tapi **0 referensi** di mana pun. Tidak
ditawarkan builder, tidak dipakai renderer, tidak dienforce server.

**Rencana**: hapus dari `types/forms.ts` (0 pemanggil, verifikasi grep), sesuai
aturan Fase 3 "hapus dari type". `redirect_url` dipertimbangkan ulang jika
dibutuhkan di Fase 7.

### `thank_you_message` / `wa_group_link` 🟢

Builder ada input; renderer (halaman `/success`) menampilkan keduanya. OK.

### `open_date` 🟡

Tidak ada UI builder terpisah, tapi `isFormActive()` (Fase 2-4) sudah
memakainya untuk menentukan form aktif. Tidak perlu enforcement tambahan.

### `visibleIf` (conditional visibility) ⚫

Dideklarasikan di `FieldConfig` (`types/forms.ts`) tapi builder **tidak punya
UI** untuk mengaturnya. Sesuai MASTER.md poin 4: **JANGAN implementasi** jika
builder tidak punya UI-nya.

**Keputusan untuk checkpoint**: default = **tandai "belum didukung"** di type
(komentar), jangan implementasi. Implementasi penuh menunggu UI builder.

---

## FIELD TYPES

Tipe di `FieldType` (`types/forms.ts:6-20`):
`text`, `long_text`, `short_text`, `number`, `email`, `phone`, `dropdown`,
`radio`, `checkbox`, `date`, `datetime`, `file_upload`, `url`, `address`.

| Tipe | Builder (FIELD_TYPES) | Renderer | buildFormSchema | Produksi |
|---|---|---|---|---|
| `text` | ✅ Teks Pendek | ✅ | ✅ | 5 field |
| `short_text` | ❌ (lihat catatan) | ✅ | ✅ | 7 field |
| `long_text` | ✅ | ✅ | ✅ | 13 field |
| `number` | ❌ | ✅ | ✅ | 0 |
| `email` | ❌ | ✅ | ✅ | 0 |
| `phone` | ❌ | ✅ | ✅ | 0 |
| `url` | ❌ | ✅ | ✅ | 0 |
| `dropdown` | ✅ | ✅ | ✅ | 2 field |
| `radio` | ✅ | ✅ | ✅ | 10 field |
| `checkbox` | ✅ | ✅ | ✅ | 0 |
| `date` | ✅ | ✅ | ✅ | 0 |
| `datetime` | ❌ | ❌ | ❌ | 0 |
| `file_upload` | ✅ | ✅ | ✅ (client) | 9 field |
| `address` | ❌ | ❌ | ❌ | 0 |

**Catatan `text` vs `short_text`**: builder menawarkan "Teks Pendek" sebagai
`text`, tapi produksi mempunyai 7 field `short_text` (data lama) dan 5 field
`text`. Renderer mendukung keduanya. Satukan: "Teks Pendek" → `short_text`
(di Fase 3-3), dengan `text` tetap didukung untuk data lama.

**Keputusan untuk checkpoint (F3-3/4)**: `number`/`email`/`phone`/`url`,
`datetime`, `address` — builder tidak menawarkannya. Pilihan:
(a) tambahkan ke builder (tipe "bernilai" bisa dipakai admin), atau
(b) tandai "belum didukung" di type & hapus dari renderer.
**Default rekomendasi: (a) untuk email/phone/url/number** (renderer sudah
mendukung, tinggal tambah tombol builder), **(b) untuk datetime/address**
(tidak ada case renderer).
