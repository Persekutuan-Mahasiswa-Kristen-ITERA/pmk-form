# UI Guide — PMK FORM

Panduan sistem desain & pola responsif platform form PMK ITERA. Berlaku untuk
semua perubahan UI setelah **UI Overhaul (U1–U5)**. Token lengkap ada di
[DESIGN_TOKENS.md](./DESIGN_TOKENS.md); laporan per fase ada di
[PROGRESS.md](./PROGRESS.md).

---

## 1. Prinsip

1. **Token yang ada menang.** Tidak boleh ada warna/font/radius baru tanpa
   mencatatnya di `DESIGN_TOKENS.md`. Pakai variabel CSS HSL
   (`bg-primary`, `text-accent`, …) — jangan hex literal seperti `#FAF6F0`
   (kecuali di token itu sendiri).
2. **Status selalu ada teksnya.** Tidak pernah hanya warna: status lewat
   `StatusBadge`, kategori lewat `CategoryBadge` (aturan referensi 3.G).
3. **Aksi destruktif wajib konfirmasi eksplisit** memakai `ConfirmDialog`
   (bermerek), bukan `window.confirm()`/`alert()`. Otorisasi tetap di server
   action (`requireAdmin()`), komponen UI hanya presentasi.
4. **Mobile-first.** mayoritas pengguna membuka dari HP: cek di 360px dan
   390px untuk setiap perubahan (tidak ada scroll horizontal selain kontainer
   geser yang disengaja), target sentuh minimal 44×44px, input 16px+.
5. **Setiap halaman punya** loading (skeleton), kosong (empty state), dan
   error (pesan aman tanpa detail DB/stack).

---

## 2. Komponen bersama (PAKAI, jangan bikin baru)

Semua di `components/`:

| Komponen | Untuk |
| --- | --- |
| `PublicShell` | Header ringan (logo + nama) + footer untuk halaman publik |
| `AdminShell` | Navbar atas admin + drawer mobile (dari U1) |
| `PageHeader` | Judul `<h1>` serif + subjudul + slot aksi kanan |
| `SectionCard` | Kartu berjudul `<h2>` + subjudul + slot aksi kanan |
| `StatCard` | Kartu statistik (varian normal/peringatan) |
| `StatusBadge` / `CategoryBadge` | Badge status & kategori (selalu ada teks) |
| `ResponsiveTable` | Tabel di desktop → daftar kartu di mobile |
| `EmptyState` | Judul + deskripsi + aksi opsional |
| `SegmentedControl` | Ganti tab berdesain (mis. rentang grafik 6/12 bln) |
| `ConfirmDialog` | Konfirmasi aksi destruktif |
| `Skeleton` | Placeholder loading (dipakai `loading.tsx`) |
| `FilterChip` (di `components/landing.tsx`) | Chip filter kategori |

**Hierarki heading:** tepat satu `<h1>` per halaman (dari `PageHeader`, atau
eksplisit seperti di login & form publik). `SectionCard` memakai `<h2>`.

---

## 3. Pola responsif

- **Breakpoint** (Tailwind v3.4): `sm` 640px, `md` 768px, `lg` 1024px.
- **Tinggi viewport** memakai `min-h-dvh` (bukan `min-h-screen`).
- **Bar bawah sticky** (form publik, builder admin) memakai
  `env(safe-area-inset-bottom)` + `backdrop-blur` + warna background semi-
  transparan; konten di atasnya diberi padding bawah ekstra (`pb-40` /
  `pb-44`) supaya tidak tertutup.
- **Tombol submit di luar `<form>`** memakai atribut `form="..."` — didukung
  semua browser modern.
- **Toolbar filter** scroll horizontal di mobile:
  `flex overflow-x-auto` + setiap chip `shrink-0`.
- **Grid kartu formulir:** 1 kolom (mobile) / 2 (tablet) / 3 (desktop).
- **Tabel admin:** `ResponsiveTable` menangani otomatis (desktop tabel,
  mobile kartu) — jangan tulis `<table>` manual lagi.
- **Drag-and-drop** (`@dnd-kit`): gunakan `TouchSensor` (dengan
  `activationConstraint`) + `KeyboardSensor`; **jangan** `PointerSensor`
  (menyerap pointer-down, membuat tombol di kartu sulit ditekan). Sertakan
  tombol naik/turun sebagai alternatif aksesibel.

### Target sentuh & input

- `components/ui/button.tsx`: `default h-11`, `sm h-11`, `lg h-12`,
  `icon min 44×44` (semua ≥44px).
- `components/ui/input.tsx`: `h-11` + `text-base` (16px — cegah zoom otomatis
  iOS saat fokus).
- Tombol ikon yang butuh override pakai `min-h-[44px] min-w-[44px]`, bukan
  `h-8 w-8`.
- Setiap tombol ikon **wajib** `aria-label` (atau teks), bukan hanya `title`.

---

## 4. Cara menambah halaman baru

**Halaman publik**

```tsx
// app/<route>/page.tsx
import { PublicShell } from "@/components/public-shell";
import { EmptyState } from "@/components/empty-state";

export default async function Page() {
  return (
    <PublicShell>
      {/* <h1> otomatis jika pakai PageHeader, atau tulis <h1> manual */}
      ...
    </PublicShell>
  );
}
```

**Halaman admin**

```tsx
// app/admin/(dashboard)/<route>/page.tsx — shell admin dari layout grup
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ResponsiveTable } from "@/components/responsive-table";

export const revalidate = 60; // atau 0 bila harus selalu segar

export default async function Page() {
  // Data di sini: server component, RLS/requireAdmin() berlaku.
  return (
    <div className="space-y-6">
      <PageHeader title="…" subtitle="…" actions={<Button … />} />
      <SectionCard title="…"><ResponsiveTable … /></SectionCard>
    </div>
  );
}
```

Otorisasi tidak boleh bergantung pada UI: server action memanggil
`requireAdmin()` (atau cek `getAdminUser()` di server component) seperti
`lib/auth.ts`. Halaman tanpa login diarahkan ke `/admin/login` oleh
`proxy.ts` (middleware) — jangan diubah.

---

## 5. 404 / error / loading

- `app/not-found.tsx` (404 global), `app/error.tsx` & `app/global-error.tsx`,
  `app/loading.tsx` (skeleton publik), `app/admin/(dashboard)/loading.tsx`.
- Halaman 404 khusus form: pesan "Formulir tidak ditemukan atau sudah ditutup"
  — **jangan** membedakan "slug tidak ada" vs "form ditutup" (batasan 6).
- Semua pesan error aman: tidak ada stack trace, nama tabel, atau PII.

---

## 6. Verifikasi rutin sebelum menyatakan selesai

1. `npx tsc --noEmit` → 0 error.
2. `npx eslint app components` → 0 error/warning.
   (`next lint` di Next 16 rusak — jalankan `npx eslint` langsung.)
3. `npm run build` → sukses.
4. `npm run test:unit` → lulus penuh.
5. Tidak ada scroll horizontal di 360px & 390px (cek via CDP atau DevTools).
6. Tidak ada target sentuh < 44px di mobile.
7. Tidak ada `window.confirm()`/`alert()` baru; aksi destruktif pakai
   `ConfirmDialog`.
