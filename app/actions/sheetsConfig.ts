"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { testConnection } from "@/lib/sheets/client";
import { syncFormBatch } from "@/lib/sheets/sync";

/**
 * Server actions konfigurasi Google Sheets per form (Fase 6-4).
 *
 * Semua aksi memanggil requireAdmin() — otorisasi di server. Config disimpan
 * di kolom JSONB forms.sheets_config (migration 010).
 *
 * Panduan parsing ID dari URL: https://docs.google.com/spreadsheets/d/<ID>/edit
 */

const SheetsConfigSchema = z.object({
  spreadsheet_id: z.string().min(10, "ID spreadsheet tidak valid."),
  sheet_name: z
    .string()
    .min(1, "Nama sheet wajib diisi.")
    .max(100, "Nama sheet terlalu panjang.")
    // Nama sheet tidak boleh memuat karakter yang berbahaya di range A1.
    .refine((v) => !/[\\/'"*[\]:]/.test(v), "Nama sheet mengandung karakter tidak diizinkan."),
  enabled: z.boolean().default(false),
});

export type SheetsConfigInput = z.infer<typeof SheetsConfigSchema>;

/**
 * Ekstrak spreadsheet ID dari URL Google Sheets, atau terima ID mentah.
 *
 *   https://docs.google.com/spreadsheets/d/1AbC123/edit#gid=0  -> 1AbC123
 *   1AbC123                                               -> 1AbC123
 */
export async function parseSpreadsheetId(input: string): Promise<string> {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

/** Ambil config Sheets form saat ini (admin only). */
export async function getSheetsConfigAction(formId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select("sheets_config")
    .eq("id", formId)
    .single();
  if (error) return { success: false as const, error: "Gagal memuat konfigurasi." };
  return { success: true as const, config: (data.sheets_config ?? null) as unknown };
}

/** Simpan config Sheets per form. */
export async function saveSheetsConfigAction(formId: string, input: Partial<SheetsConfigInput>) {
  await requireAdmin();

  const parsed = SheetsConfigSchema.safeParse({
    spreadsheet_id: await parseSpreadsheetId(input.spreadsheet_id ?? ""),
    sheet_name: (input.sheet_name ?? "").trim(),
    enabled: input.enabled ?? false,
  });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("forms")
    .update({ sheets_config: parsed.data })
    .eq("id", formId);
  if (error) return { success: false as const, error: "Gagal menyimpan konfigurasi." };

  revalidatePath(`/admin/forms/${formId}`);
  return { success: true as const };
}

/**
 * Tes koneksi ke spreadsheet (Fase 6-4).
 *
 * Mengembalikan pesan yang JELAS untuk admin: bila sheet belum di-share ke
 * service account, pesan menyertakan email service account yang harus
 * ditambahkan.
 */
export async function testSheetsConnectionAction(formId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select("sheets_config")
    .eq("id", formId)
    .single();
  if (error || !data) return { success: false as const, error: "Form tidak ditemukan." };

  const cfg = data.sheets_config as { spreadsheet_id?: string; sheet_name?: string } | null;
  if (!cfg?.spreadsheet_id || !cfg.sheet_name) {
    return { success: false as const, error: "Isi ID spreadsheet dan nama sheet dulu." };
  }

  const result = await testConnection(cfg.spreadsheet_id, cfg.sheet_name);
  if (result.ok) {
    return { success: true as const, message: result.message };
  }
  return { success: false as const, error: result.message, message: result.message };
}

/** Status sinkronisasi form: jumlah pending/failed + sinkron terakhir. */
export async function getSheetsStatusAction(formId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sheets_outbox")
    .select("status")
    .eq("form_id", formId);

  if (error) return { success: false as const, error: "Gagal memuat status." };

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const synced = rows.filter((r) => r.status === "synced").length;

  // Sinkron terakhir = synced_at baris synced terbaru.
  let lastSyncedAt: string | null = null;
  const { data: lastRow } = await supabase
    .from("sheets_outbox")
    .select("synced_at")
    .eq("form_id", formId)
    .eq("status", "synced")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  lastSyncedAt = lastRow?.synced_at ?? null;

  return { success: true as const, status: { pending, failed, synced, lastSyncedAt } };
}

/**
 * Coba ulang sinkronisasi yang gagal (Fase 6-4).
 *
 * Reset baris failed -> pending dengan next_attempt_at sekarang, supaya
 * cron/segera memprosesnya. Idempoten.
 */
export async function retryFailedSyncAction(formId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sheets_outbox")
    .update({ status: "pending", next_attempt_at: new Date().toISOString() })
    .eq("form_id", formId)
    .eq("status", "failed")
    .select("response_id");

  if (error) return { success: false as const, error: "Gagal menjadwalkan ulang." };
  return { success: true as const, count: (data ?? []).length };
}

/**
 * Backfill: daftarkan SEMUA respons form ke outbox (Fase 6-4).
 *
 * Idempoten: response_id adalah PK outbox, insert baris yang sudah ada
 * di-skip (onConflict do nothing). Batched untuk form besar.
 */
export async function backfillSyncAction(formId: string) {
  await requireAdmin();
  const supabase = await createClient();

  // Cek config aktif dulu (jangan backfill form tanpa integrasi).
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("sheets_config")
    .eq("id", formId)
    .single();
  if (formError || !form) {
    return { success: false as const, error: "Form tidak ditemukan." };
  }
  const cfg = (form.sheets_config ?? {}) as { enabled?: boolean };
  if (!cfg.enabled) {
    return { success: false as const, error: "Aktifkan integrasi Sheets untuk form ini dulu." };
  }

  const BATCH = 200;
  let inserted = 0;
  let cursor = 0;

  // Ambil semua response_id form, lalu insert ke outbox batch-by-batch.
  while (true) {
    const { data: responses, error: respError } = await supabase
      .from("form_responses")
      .select("id")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: true })
      .range(cursor, cursor + BATCH - 1);

    if (respError) return { success: false as const, error: "Gagal memuat respons." };
    if (!responses || responses.length === 0) break;

    const rows = responses.map((r) => ({
      response_id: r.id as string,
      form_id: formId,
      status: "pending" as const,
    }));

    const { error: insertError } = await supabase
      .from("sheets_outbox")
      .upsert(rows, { onConflict: "response_id", ignoreDuplicates: true });

    if (insertError) {
      // 42P01/42703: migration 010 belum dijalankan.
      return { success: false as const, error: "Tabel outbox belum tersedia. Jalankan migration 010." };
    }

    inserted += rows.length;
    if (responses.length < BATCH) break;
    cursor += BATCH;
  }

  // Proses antrinya SEKARANG, tidak menunggu cron (yang di paket Hobby hanya
  // 1x sehari). syncFormBatch mengirim seluruh baris form dalam SATU panggilan
  // append, jadi 240 respons = 1 request ke Google.
  const syncResult = await syncFormBatch(formId);

  revalidatePath(`/admin/forms/${formId}`);
  return {
    success: true as const,
    count: inserted,
    synced: syncResult.synced,
    syncError: syncResult.error,
  };
}
