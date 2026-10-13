import { createClient } from "@/lib/supabase/server";

/**
 * Status sinkronisasi Google Sheets untuk satu form (admin).
 *
 * Versi data-murni dari `getSheetsStatusAction` (app/actions/sheetsConfig.ts)
 * supaya bisa di-fetch di Server Component bersama data lain — menghindari
 * request kedua via useEffect setelah halaman dirender.
 *
 * Dua query dijalankan paralel (hitungan status + baris synced terbaru) dalam
 * satu round-trip ke Supabase.
 *
 * Otorisasi: halaman ini hanya bisa diakses admin (proxy + layout admin), dan
 * tabel sheets_outbox dilindungi RLS admin-only.
 */
export async function getSheetsStatus(formId: string): Promise<{
  pending: number;
  failed: number;
  synced: number;
  lastSyncedAt: string | null;
}> {
  const supabase = await createClient();

  const [counts, lastSynced] = await Promise.all([
    supabase.from("sheets_outbox").select("status").eq("form_id", formId),
    supabase
      .from("sheets_outbox")
      .select("synced_at")
      .eq("form_id", formId)
      .eq("status", "synced")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (counts.error) {
    return { pending: 0, failed: 0, synced: 0, lastSyncedAt: null };
  }

  const rows = counts.data ?? [];
  return {
    pending: rows.filter((r) => r.status === "pending").length,
    failed: rows.filter((r) => r.status === "failed").length,
    synced: rows.filter((r) => r.status === "synced").length,
    lastSyncedAt: lastSynced.data?.synced_at ?? null,
  };
}
