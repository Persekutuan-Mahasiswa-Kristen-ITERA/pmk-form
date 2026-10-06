# Design Tokens — PMK Form Platform

Dokumentasi ini adalah inventarisasi **token desain yang sudah ada** di kode
(ubahannya bersifat presentasional: token tidak ditambah/diganti — lihat
`docs/prompts/PROMPT_UI_OVERHAUL_PMK_FORM.md` batasan 1).

Sumber token:
- `app/globals.css` → CSS variables (HSL) di `:root`
- `tailwind.config.ts` → pemetaan CSS variable ke utility class Tailwind
- `app/layout.tsx` → `next/font` (Playfair Display + Inter)
- `components/PMKLogo.tsx` → sumber URL logo

Aturan: **token yang ada menang**. Jangan tambah warna/font baru. Varian baru
(mis. latar status) wajib diturunkan dari token di bawah dan dicatat di file ini.

---

## 1. Warna (HSL CSS variables → nilai heksadesimal)

| Token | HSL | Heks | Kegunaan |
|---|---|---|---|
| `--background` | `42 41% 96%` | `#F8F6F0` | Latar halaman (krem hangat off-white) |
| `--foreground` | `17 46% 12%` | `#2C1810` | Teks utama (cokelat tua) |
| `--card` | `42 41% 96%` | `#F8F6F0` | Latar kartu — **sama dengan background** |
| `--card-foreground` | `17 46% 12%` | `#2C1810` | Teks di kartu |
| `--popover` | `42 41% 96%` | `#F8F6F0` | Latar popover/dropdown |
| `--popover-foreground` | `17 46% 12%` | `#2C1810` | Teks popover |
| `--primary` | `19 56% 40%` | `#9F512C` | Accent utama (cokelat kemerahan / rust) |
| `--primary-foreground` | `42 41% 96%` | `#F8F6F0` | Teks di atas primary |
| `--secondary` | `40 64% 87%` | `#F3E4C8` | Krem sekunder (badge, latar halus) |
| `--secondary-foreground` | `17 46% 12%` | `#2C1810` | Teks di atas secondary |
| `--muted` | `40 64% 87%` | `#F3E4C8` | Sama dengan secondary |
| `--muted-foreground` | `17 46% 35%` | `#824730` | Teks sekunder/abu-cokelat |
| `--accent` | `46 65% 52%` | `#D4AF35` | Emas (tombol utama, cincin logo, fokus) |
| `--accent-foreground` | `17 46% 12%` | `#2C1810` | Teks di atas accent |
| `--destructive` | `0 84.2% 60.2%` | `#EE4444` | Merah peringatan/destruktif |
| `--destructive-foreground` | `0 0% 98%` | `#FAFAFA` | Teks di atas destructive |
| `--border` | `40 40% 85%` | `#E8DDC9` | Border tipis krem |
| `--input` | `40 40% 85%` | `#E8DDC9` | Border input |
| `--ring` | `46 65% 52%` | `#D4AF35` | Warna focus ring |
| `--chart-1` | `12 76% 61%` | `#E76E4F` | Seri grafik 1 (koral) — "Respons per bulan" |
| `--chart-2` | `173 58% 39%` | `#299D8F` | Seri grafik 2 (teal) — "Formulir dibuka" |
| `--chart-3` | `197 37% 24%` | `#264753` | Seri grafik 3 |
| `--chart-4` | `43 74% 66%` | `#E8C468` | Seri grafik 4 |
| `--chart-5` | `27 87% 67%` | `#F4A361` | Seri grafik 5 |

### Catatan & perbedaan penting

1. **`--card` identik dengan `--background`.** Referensi dashboard meminta
   "kartu putih di atas latar krem". Pola yang sudah dipakai di kode dan akan
   dijaga: **latar halaman = `bg-background` (krem), kartu = `bg-white`**
   (lihat `dashboard/page.tsx`, `login/page.tsx`, `403` card). Tidak ada token
   baru; `bg-white` adalah utility Tailwind standar.
2. **`#FAF6F0` (hex hardcoded) vs `--background` `#F8F6F0`** — dipakai di
   ~11 tempat (`app/page.tsx`, `app/form/[slug]/page.tsx`, admin layout,
   login, `FormCard`, `GenericFormRenderer`). Praktis identik (selisih 2 unit).
   **Rencana U1:** jadikan `bg-background` sumber tunggal, hapus hex hardcoded
   secara bertahap. Delta visual tak terlihat.
3. **`#D4AF35` (hex hardcoded, `FormCard` border) == `--accent`** — sama persis;
   akan diganti `border-accent`.
4. Token `--chart-1..5` **sudah ada sejak awal tapi belum pernah dipakai**
   (0 referensi). Grafik "Respons per periode" (U2) akan memakainya:
   `chart-1` (koral) untuk batang respons, `chart-2` (teal) untuk garis
   formulir dibuka — sesuai legenda referensi. **Tidak ada warna baru.**

### Warna kategori (dipakai persis seperti kode现有, jangan diciptakan ulang)

Sumber: `components/FormCard.tsx` `badgeColors`.

| Kategori | Kelas Tailwind |
|---|---|
| Recruitment | `bg-primary text-primary-foreground` |
| Event | `bg-amber-600 text-white` |
| Survei | `bg-blue-600 text-white` |
| Presensi | `bg-emerald-600 text-white` |
| Umum | `bg-secondary text-secondary-foreground` |

### Warna status respons (sumber: `components/StatusCell.tsx`)

| Status | Kelas Tailwind |
|---|---|
| Diterima | `bg-green-100 text-green-800 border-green-300` |
| Tidak Lolos | `bg-red-100 text-red-800 border-red-300` |
| Cadangan | `bg-amber-100 text-amber-800 border-amber-300` |

### Warna lain yang hardcoded di kode (dipertahankan, catat di sini)

- `#25D366` (hijau WhatsApp) + `hover:#128C7E` — tombol grup WA (success page).
- `bg-red-100/border-red-200/text-red-700` — varian peringatan `StatCard`
  (`components/landing.tsx`) — dasar kartu "Segera ditutup".

---

## 2. Tipografi

| Peran | Font | Kelas |
|---|---|---|
| Sans (tubuh teks) | **Inter** (`next/font/google`, `--font-inter`) | `font-sans` |
| Serif display (judul halaman, judul kartu, angka statistik) | **Playfair Display** (`next/font/google`, `--font-playfair`) | `font-serif` |

Kedua font: `subsets: ["latin"]`, `display: "swap"`, `preload: true`.
**Tidak boleh menambah font/skrip eksternal** (batasan 4).

Skala yang dipakai saat ini (Tailwind default): `text-xs` (12px) → `text-6xl`.
Aturan baru U1: isi minimal `text-sm` (14px), label kecil boleh `text-xs` (12px),
**input minimal `text-base` (16px)** (anti-zoom iOS).

---

## 3. Radius, border, bayangan, spacing

- **Radius:** `--radius: 0.75rem` (12px). Tailwind: `rounded-lg` = 12px,
  `rounded-md` = 10px, `rounded-sm` = 8px. Banyak komponen memakai
  `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-3xl` (24px) — pertahankan
  ritme ini (referensi: "sudut membulat sekitar 12px").
- **Border:** tipis 1px, warna `border-border` (`#E8DDC9`). Beberapa kartu
  memakai `border-t-4`/`border-t-8` aksen — pertahankan untuk hierarki.
- **Bayangan:** Tailwind standar (`shadow-sm` … `shadow-2xl`). Tidak ada token
  shadow custom. Referensi: "bayangan sangat halus atau tanpa bayangan" →
  `shadow-sm` sebagai default kartu.
- **Spacing:** ritme vertikal antar blok `space-y-6`/`space-y-8` (24–32px),
  padding kartu `p-4`…`p-6` (16–24px). Pertahankan.
- **Lebar konten:** `max-w-6xl` (72rem) untuk publik, `max-w-7xl` (80rem)
  untuk admin, `max-w-3xl`/`max-w-5xl` untuk form/builder/respons.

---

## 4. Breakpoint

Tailwind default (tidak diubah): `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 ·
`2xl` 1536. Container default Tailwind (max-width per breakpoint).
**Uji wajib U1–U5:** 360, 390, 768, 1024, 1440.

---

## 5. Logo

`<PMKLogo />` (`components/PMKLogo.tsx`) — sumber tunggal:
`https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif`
(hostname sudah ada di `remotePatterns` `next.config.ts` — jangan hapus).
Pembungkus: bulat, `border-4 border-accent`, `bg-white`, `shadow-lg`.
`PMK_LOGO_URL` dipakai 6 tempat (login, admin layout, renderer form, dll).

---

## 6. Yang BELUM ada (perlu ditambah di U1, presentasional)

- `export const viewport` di root layout (viewport-fit=cover iOS + safe-area
  + `theme-color` selaras `--background`/`--primary`).
- Utility `scrollbar-hide` — **dipakai di 2 tempat tapi TIDAK didefinisikan**
  (tailwind.config / globals.css) → scrollbar masih terlihat. Akan didefinisikan
  di `globals.css` di U1.
- Kelas `dvh`/`min-h-dvh` belum dipakai; layout satu layar masih `min-h-screen`.
- Skeleton bermerek per route (root `loading.tsx` masih spinner polos).

---

## 7. Token turunan & utility yang ditambah di U1 (tidak ada warna/font baru)

Semua di bawah diturunkan dari token bagian 1–5. Tidak ada warna, font, atau
dependency baru yang ditambahkan.

**Utility CSS (`app/globals.css`, `@layer utilities`):**
- `.scrollbar-hide` — menyembunyikan scrollbar (sebelumnya dead class: dipakai
  di navbar admin + filter landing tapi belum didefinisikan).
- `.pt-safe` / `.pb-safe` — `padding-top`/`padding-bottom`
  `env(safe-area-inset-*)` untuk bar tetap (navbar, bottom bar) di iOS.

**Viewport (`app/layout.tsx`):**
- `export const viewport`: `width: "device-width"`, `initialScale: 1`,
  `viewportFit: "cover"` (viewport-fit=cover untuk safe-area iOS),
  `themeColor: "#F8F6F0"` (sama dengan `--background`).

**Varian status (turunan, bukan warna baru):**
- `StatCard` varian `warning`: `border-destructive/40 bg-destructive/5` +
  angka `text-destructive` — dipakai untuk kartu "Segera ditutup" saat > 0.
  Saat 0, pemanggil memakai varian `default` (netral) sesuai aturan 3.D.
- `StatusBadge`: pol + titik (`bg-current`) + **teks wajib** dari
  `getFormStatus()`. Kelas per status (`lib/form-status.ts`
  `FORM_STATUS_STYLES`):
  `closing_soon` `bg-destructive/10 text-destructive border-destructive/30`,
  `open` `bg-chart-2/10 text-chart-2 border-chart-2/30` (token chart teal),
  `closed`/`not_open` `bg-secondary text-muted-foreground border-border`.
- `CategoryBadge`: kelas dipetakan dari `lib/form-status.ts` `CATEGORY_STYLES`
  (asalnya `FormCard.tsx` `badgeColors`): recruitment `bg-primary
  text-primary-foreground`, event `bg-amber-600 text-white`, survei
  `bg-blue-600 text-white`, presensi `bg-emerald-600 text-white`, general
  `bg-secondary text-secondary-foreground`.

**Font 16px untuk input (aturan iOS, mencegah zoom otomatis Safari):**
diberlakukan per-halaman form di U3 (`/form/[slug]`), bukan global.

**Dvh:** layout satu layar (404, error, login) memakai `min-h-dvh`
(`AdminShell`, `PublicShell`, `AccessDeniedCard`, halaman state).
