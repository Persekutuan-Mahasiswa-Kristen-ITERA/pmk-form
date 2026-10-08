/**
 * Helper format tanggal & status form (UI Overhaul U1).
 *
 * Semua fungsi murni (pure) supaya bisa diuji unit tanpa env/DB
 * (pola tes: `tests/*.test.ts` + `node --test`).
 *
 * Zona waktu: WIB (Asia/Jakarta, UTC+7). `Intl.DateTimeFormat` dengan
 * `timeZone: "Asia/Jakarta"` dipakai supaya penaggalan konsisten terlepas
 * dari zona waktu server (Vercel default UTC) atau browser pengguna.
 */

const WIB = "Asia/Jakarta";
const ID = "id-ID";

/** Opsi format standar yang dipakai di seluruh app. */
const FORMAT_OPTIONS = {
  /** "12 Nov 2026" — tanggal singkat di meta baris/kartu. */
  short: {
    day: "numeric",
    month: "short",
    year: "numeric",
  } as const,
  /** "12 November 2026" — tanggal lengkap untuk info deadline. */
  long: {
    day: "numeric",
    month: "long",
    year: "numeric",
  } as const,
  /** "12 Nov 2026, 23.59" — tanggal + waktu. */
  datetime: {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  } as const,
};

export type DateFormatStyle = keyof typeof FORMAT_OPTIONS;

/**
 * Format tanggal ISO/UTC ke teks bahasa Indonesia dalam zona WIB.
 *
 * Mengembalikan string kosong bila input tidak valid (bukan throw) supaya
 * UI tidak crash saat data DB bernilai aneh.
 */
export function formatDate(
  date: string | Date | null | undefined,
  style: DateFormatStyle = "short",
): string {
  if (!date) return "";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(ID, {
    ...FORMAT_OPTIONS[style],
    timeZone: WIB,
  }).format(parsed);
}

/**
 * Selisih hari dari sekarang hingga `date` (positif = masa depan).
 *
 * Zona WIB. Pembulatan ke hari kalender lengkap (bukan 24-jam pecahan),
 * supaya "ditutup 2 hari lagi" sesuai intuisi manusia.
 */
export function daysUntil(date: string | Date | null | undefined): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const target = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;

  // "Hari" dalam zona WIB, bukan timestamp mentah.
  const nowWib = new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone: WIB,
      dateStyle: "short",
    }).format(new Date()),
  );
  const targetWib = new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone: WIB,
      dateStyle: "short",
    }).format(target),
  );

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((targetWib.getTime() - nowWib.getTime()) / MS_PER_DAY);
}

/** true bila `date` sudah lewat (dibandingkan dalam zona WIB). */
export function isPast(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  const target = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return false;
  return target.getTime() <= Date.now();
}

/**
 * Rentang bulan kalender untuk grafik "Respons per periode".
 *
 * Mengembalikan array "kunci bulan" (`YYYY-MM`) dari `months` bulan terakhir
 * hingga bulan saat ini, semuanya dalam zona WIB. Setiap entri membawa label
 * bahasa Indonesia ("Jan", "Feb", …) untuk sumbu X grafik.
 *
 * `now` opsional hanya untuk kemudahan tes unit; default `Date.now()`.
 */
export interface MonthBucket {
  /** Kunci bulan, mis. "2026-10". */
  key: string;
  /** Label pendek Indonesia, mis. "Okt". */
  label: string;
  /** Label lengkap, mis. "Okt 2026". */
  labelLong: string;
  /** Tahun bulan ini (untuk penanda tahun baru di sumbu X). */
  year: number;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function lastMonths(months: number, now: number = Date.now()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  // Titik awal: awal bulan kalender WIB saat ini.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(now));
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);

  for (let i = months - 1; i >= 0; i--) {
    // Geser mundur sejumlah bulan dari bulan saat ini.
    const totalMonths = (year * 12 + (month - 1)) - i;
    const y = Math.floor(totalMonths / 12);
    const m = ((totalMonths % 12) + 12) % 12; // 0-index
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: MONTH_LABELS[m],
      labelLong: `${MONTH_LABELS[m]} ${y}`,
      year: y,
    });
  }
  return buckets;
}

/**
 * Kelompokkan daftar timestamp ke bucket bulan kalender WIB.
 *
 * Dipakai untuk agregasi grafik di sisi client (data sudah diambil dari server
 * hanya kolom `created_at`/`open_date`).
 */
export function bucketizeByMonth(
  dates: (string | Date)[],
  buckets: MonthBucket[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of buckets) counts[b.key] = 0;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
  });

  for (const d of dates) {
    const parsed = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(parsed.getTime())) continue;
    const parts = formatter.formatToParts(parsed);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const key = `${y}-${m}`;
    if (key in counts) counts[key] += 1;
  }

  return counts;
}
