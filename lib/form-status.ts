/**
 * Helper status form (UI Overhaul U1).
 *
 * SATU sumber kebenaran untuk label status form yang ditampilkan di UI.
 *
 * Aturan (lihat `PROMPT_UI_OVERHAUL_PMK_FORM.md` 3.G): status TIDAK boleh
 * hanya berbasis warna — teks wajib ada. Karena itu setiap entri membawa
 * `label`.
 *
 * Definisi "aktif" memakai `isFormActive()` dari `lib/forms` (definisi tunggal
 * Fase 2-4) — file ini hanya menerjemahkan ke label/kelas tampilan, tidak
 * menciptakan definisi baru.
 *
 * Semua fungsi murni (pure) supaya bisa diuji unit tanpa env/DB.
 */

import { isFormActive } from "@/lib/forms";

export type FormStatusKind =
  | "not_open" // sekarang < open_date (belum dibuka)
  | "open" // aktif (dibuka)
  | "closing_soon" // aktif & close_date dalam <= 7 hari
  | "closed"; // ditutup (is_open false atau close_date sudah lewat)

export interface FormStatus {
  kind: FormStatusKind;
  /** Teks yang ditampilkan di badge (wajib ada — bukan hanya warna). */
  label: string;
}

/** Ambang batas "segera ditutup" (hari). Sama dengan `computeFormStats`. */
export const CLOSING_SOON_DAYS = 7;

/**
 * Status tampilan sebuah form untuk `StatusBadge`.
 *
 * Urutan pengecekan:
 * 1. `closing_soon` — form AKTIF dan `close_date` <= 7 hari lagi (paling
 *    spesifik, ditampilkan dulu supaya admin segera melihat).
 * 2. `open` — aktif (hasil `isFormActive`).
 * 3. `closed` — `is_open` false atau `close_date` sudah lewat.
 * 4. `not_open` — `is_open` true tetapi `open_date` masih di masa depan.
 *
 * Catatan: `isFormActive` mengembalikan false untuk `not_open` (open_date
 * belum tercapai), jadi pemeriksaan dilakukan setelahnya.
 */
export function getFormStatus(form: {
  is_open: boolean | null;
  open_date: string | null;
  close_date: string | null;
}): FormStatus {
  const active = isFormActive(form);
  const now = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const closeInDays =
    form.close_date != null
      ? (new Date(form.close_date).getTime() - now) / MS_PER_DAY
      : Number.POSITIVE_INFINITY;

  if (active && closeInDays <= CLOSING_SOON_DAYS) {
    return { kind: "closing_soon", label: "Segera ditutup" };
  }
  if (active) {
    return { kind: "open", label: "Dibuka" };
  }
  // Tidak aktif: bisa karena belum dibuka, atau sudah ditutup.
  if (
    form.is_open &&
    form.open_date &&
    new Date(form.open_date).getTime() > now
  ) {
    return { kind: "not_open", label: "Belum dibuka" };
  }
  return { kind: "closed", label: "Ditutup" };
}

/**
 * Kelas Tailwind untuk `StatusBadge` per status.
 *
 * Turunan dari token yang ada (`destructive`, `chart-2` teal, `secondary`
 * krem) — tidak ada warna baru. Semua memakai pola "pil + titik" (lihat
 * `StatusBadge.tsx`): titik dari `currentColor` memastikan teks dan dot
 * selalu kontras, dan status tidak hanya conveyed oleh warna.
 */
export const FORM_STATUS_STYLES: Record<FormStatusKind, string> = {
  closing_soon: "bg-destructive/10 text-destructive border-destructive/30",
  open: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  closed: "bg-secondary text-muted-foreground border-border",
  not_open: "bg-muted/60 text-muted-foreground border-border",
};

/**
 * Daftar kategori yang dipakai untuk `CategoryBadge`.
 *
 * Warna dipetakan persis dari `components/FormCard.tsx` (`badgeColors`,
 * Fase 1) — jangan diciptakan ulang. Token: `primary` (rust), amber, blue,
 * emerald, `secondary` (krem).
 */
export const CATEGORY_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  recruitment: {
    label: "Recruitment",
    className: "bg-primary text-primary-foreground",
  },
  event: { label: "Event", className: "bg-amber-600 text-white" },
  survey: { label: "Survei", className: "bg-blue-600 text-white" },
  presensi: { label: "Presensi", className: "bg-emerald-600 text-white" },
  general: {
    label: "Umum",
    className: "bg-secondary text-secondary-foreground",
  },
};

/** Kelas kategori untuk nilai `form_type` tak dikenal (fallback aman). */
export const CATEGORY_DEFAULT = {
  label: "Umum",
  className: "bg-secondary text-secondary-foreground",
};
