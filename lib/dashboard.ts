/**
 * Agregasi data untuk dashboard admin (UI Overhaul U2).
 *
 * Semua query di sini memakai `requireAdmin()` (lewat `createAdminClient`)
 * dan hanya mengambil kolom yang dibutuhkan — **TIDAK PERNAH mengambil
 * `answers`/`files`** dari `form_responses` (batasan prompt 3.E: jangan tarik
 * data responden hanya untuk agregasi grafik).
 *
 * Zona waktu: WIB (Asia/Jakarta) lewat helper di `lib/format.ts`, supaya
 * "bulan ini" / "6 bulan terakhir" konsisten terlepas dari zona server
 * (Vercel default UTC) atau browser admin.
 */
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { lastMonths, bucketizeByMonth, type MonthBucket } from "@/lib/format";

/**
 * Data grafik "Respons per periode" (prompt 3.E).
 *
 * - `responseCounts`: jumlah respons per bulan (batang, `chart-1` koral).
 * - `formOpenedCounts`: jumlah form yang DIBUKA per bulan (garis/penanda,
 *   `chart-2` teal) — berdasarkan `open_date`, fallback `created_at`.
 * - `total`: total respons dalam periode ini (untuk subjudul kartu).
 */
export interface ChartData {
  buckets: MonthBucket[];
  responseCounts: Record<string, number>;
  formOpenedCounts: Record<string, number>;
  total: number;
}

/**
 * Ambil data grafik untuk N bulan terakhir (zona WIB).
 *
 * Mengambil HANYA kolom `submitted_at` dari `form_responses` dan `open_date`/
 * `created_at` dari `forms` — bukan `answers`. Bucketing per bulan kalender
 * WIB dilakukan di server lewat `bucketizeByMonth`.
 */
export async function getResponseChartData(
  months: number = 6,
): Promise<ChartData> {
  await requireAdmin();
  const supabase = await createClient();

  const buckets = lastMonths(months);
  // Awal bucket pertama, dalam UTC (untuk filter query DB).
  const startDate = new Date(`${buckets[0].key}-01T00:00:00Z`);

  // --- Respons per bulan ---
  // select hanya submitted_at; filter rentang waktu agar tidak tarik semua
  // baris respons. `count: "exact"` tidak bisa dipakai bersama grouping
  // non-trivial di PostgREST, jadi ambil kolomnya lalu bucket di JS.
  const { data: responseRows, error: responseError } = await supabase
    .from("form_responses")
    .select("submitted_at")
    .gte("submitted_at", startDate.toISOString())
    .order("submitted_at", { ascending: true });

  if (responseError) {
    throw new Error(`Gagal memuat data respons: ${responseError.message}`);
  }

  const submittedDates = (responseRows ?? []).map(
    (row: { submitted_at: string }) => row.submitted_at,
  );
  const responseCounts = bucketizeByMonth(submittedDates, buckets);

  // --- Form dibuka per bulan ---
  // Ambil form yang open_date (fallback created_at) jatuh dalam periode.
  const { data: formRows, error: formError } = await supabase
    .from("forms")
    .select("open_date, created_at, is_deleted")
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (formError) {
    throw new Error(`Gagal memuat data form: ${formError.message}`);
  }

  const openedDates = (formRows ?? [])
    // open_date null jarang terjadi (NOT NULL di produksi); fallback created_at
    .map((row: { open_date: string | null; created_at: string }) =>
      row.open_date ?? row.created_at,
    );
  const formOpenedCounts = bucketizeByMonth(openedDates, buckets);

  const total = Object.values(responseCounts).reduce((a, b) => a + b, 0);

  return { buckets, responseCounts, formOpenedCounts, total };
}

/**
 * Statistik bulan berjalan untuk kartu "RESPONS MASUK" (prompt 3.D).
 *
 * "+N bulan ini" = respons pada bulan kalender berjalan dalam zona WIB.
 * Mengembalikan objek dengan `count` dan `trend` ("up" bila > 0, "flat" bila 0
 * atau menurun — prompt 3.D: "Jika 0 atau turun, tampilkan netral").
 */
export async function getMonthlyResponseStats(): Promise<{
  count: number;
  trend: "up" | "flat";
}> {
  await requireAdmin();
  const supabase = await createClient();

  // Bulan berjalan dalam WIB.
  const [current] = lastMonths(1);
  const startDate = new Date(`${current.key}-01T00:00:00Z`);

  const { count, error } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .gte("submitted_at", startDate.toISOString());

  if (error) {
    throw new Error(`Gagal menghitung respons bulan ini: ${error.message}`);
  }

  const value = count ?? 0;
  return { count: value, trend: value > 0 ? "up" : "flat" };
}

/**
 * Total respons semua form (untuk kartu "RESPONS MASUK").
 *
 * Memakai `count: "exact"` + `head: true` — hanya hitung, tanpa ambil baris.
 */
export async function getTotalResponseCount(): Promise<number> {
  await requireAdmin();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Gagal menghitung total respons: ${error.message}`);
  }
  return count ?? 0;
}
