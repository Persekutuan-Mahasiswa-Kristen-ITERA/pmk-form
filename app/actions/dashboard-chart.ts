"use server";

/**
 * Server action grafik dashboard (UI Overhaul U2).
 *
 * HARUS berada di file terpisah dari `lib/dashboard.ts`: file ini diimpor oleh
 * client component (`responses-chart-card.tsx`) untuk memuat ulang data saat
 * periode berubah. `lib/dashboard.ts` mengimpor `createClient()` yang memakai
 * `next/headers` (server-only) — jika ia diimpor langsung ke client bundle,
 * build gagal.
 *
 * Anehnya satu-satunya hal yang client-butuh dari sini adalah pemanggilan ulang
 * `getResponseChartData`; tipe `ChartData` diekspor di sini juga supaya client
 * tidak perlu menyentuh modul server-only.
 */
import { getResponseChartData } from "@/lib/dashboard";

export type ChartData = Awaited<ReturnType<typeof getResponseChartData>>;

/**
 * Muat ulang data grafik untuk periode yang dipilih admin.
 *
 * Otorisasi: `getResponseChartData` memanggil `requireAdmin()` di server —
 * client tidak bisa memakai action ini tanpa sesi admin.
 */
export async function loadChartAction(months: number): Promise<ChartData> {
  return getResponseChartData(months);
}
