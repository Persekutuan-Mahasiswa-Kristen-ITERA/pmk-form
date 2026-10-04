import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  getSheetsConfig,
  ensureHeader,
  appendRows,
  rowExists,
} from "@/lib/sheets/client";
import { buildRow, sanitizeError, backoffMinutes } from "@/lib/sheets/format";
import type { FieldConfig } from "@/types/forms";

/**
 * Layanan sinkronisasi outbox Google Sheets (Fase 6-3).
 *
 * PRINSIP:
 *   - form_responses adalah sumber kebenaran. Sheets hanya mirror.
 *   - Kegagalan Google TIDAK menggagalkan submit pendaftar (error hanya
 *     mengubah status outbox).
 *   - Idempoten per response_id (rowExists cek kolom __response_id).
 *   - last_error disanitasi (tanpa PII/secret).
 */

const MAX_ATTEMPTS = 5;

/**
 * Sinkronkan satu outbox baris ke sheet.
 *
 * @returns status baru baris ('synced' | 'failed' | 'pending') untuk
 *          dipanggil oleh pemanggil (cron atau after()).
 */
export async function syncOne(responseId: string): Promise<{
  status: "synced" | "failed" | "pending";
  error?: string;
}> {
  const supabase = createServiceClient();

  // Ambil baris outbox + respons + fields form dalam satu round-trip.
  const { data: outbox, error: outboxError } = await supabase
    .from("sheets_outbox")
    .select("response_id, form_id, status, attempts")
    .eq("response_id", responseId)
    .single();
  if (outboxError || !outbox) {
    return { status: "failed", error: "Baris outbox tidak ditemukan." };
  }
  if (outbox.status === "synced") return { status: "synced" };

  // Form + respons.
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, form_fields, sheets_config")
    .eq("id", outbox.form_id)
    .single();
  if (formError || !form) {
    return { status: "failed", error: "Form tidak ditemukan." };
  }

  const cfg = getSheetsConfig(form);
  if (!cfg || !cfg.enabled) {
    // Fitur dimatikan per form -> biarkan pending, tidak dianggap gagal.
    return { status: "pending" };
  }

  const { data: response, error: respError } = await supabase
    .from("form_responses")
    .select("id, answers")
    .eq("id", responseId)
    .single();
  if (respError || !response) {
    return { status: "failed", error: "Respons tidak ditemukan." };
  }

  const fields = (form.form_fields ?? []) as FieldConfig[];

  try {
    // Header ( tulis ulang saat field berubah; aman/idempoten).
    await ensureHeader(cfg.spreadsheet_id, cfg.sheet_name, fields);

    // Idempotensi: lewati bila sudah ada di sheet.
    const exists = await rowExists(cfg.spreadsheet_id, cfg.sheet_name, responseId);
    if (exists) {
      await markSynced(supabase, responseId);
      return { status: "synced" };
    }

    const row = buildRow(fields, response.answers ?? {}, responseId);
    await appendRows(cfg.spreadsheet_id, cfg.sheet_name, [row]);

    await markSynced(supabase, responseId);
    return { status: "synced" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tak dikenal.";
    const nextAttempt = outbox.attempts + 1;
    const exhausted = nextAttempt >= MAX_ATTEMPTS;

    await supabase
      .from("sheets_outbox")
      .update({
        status: exhausted ? "failed" : "pending",
        attempts: nextAttempt,
        last_error: sanitizeError(message),
        next_attempt_at: exhausted ? null : new Date(Date.now() + backoffMinutes(nextAttempt) * 60_000).toISOString(),
        synced_at: null,
      })
      .eq("response_id", responseId);

    return {
      status: exhausted ? "failed" : "pending",
      error: sanitizeError(message),
    };
  }
}

async function markSynced(
  supabase: ReturnType<typeof createServiceClient>,
  responseId: string
): Promise<void> {
  await supabase
    .from("sheets_outbox")
    .update({
      status: "synced",
      last_error: null,
      next_attempt_at: null,
      synced_at: new Date().toISOString(),
    })
    .eq("response_id", responseId);
}

/**
 * Proses batch baris yang perlu dicoba (cron). Ambil pending/failed yang
 * sudah lewat next_attempt_at, urut per form untuk efisiensi batching.
 *
 * @returns ringkasan untuk logging (aman: hanya jumlah, tanpa PII).
 */
export async function processOutboxBatch(batchSize = 50): Promise<{
  processed: number;
  synced: number;
  failed: number;
  retried: number;
}> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: pending, error } = await supabase
    .from("sheets_outbox")
    .select("response_id")
    .in("status", ["pending", "failed"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("form_id")
    .limit(batchSize);

  if (error || !pending) {
    return { processed: 0, synced: 0, failed: 0, retried: 0 };
  }

  let synced = 0;
  let failed = 0;
  let retried = 0;

  for (const row of pending) {
    const result = await syncOne(row.response_id);
    if (result.status === "synced") synced += 1;
    else if (result.status === "failed") failed += 1;
    else retried += 1;
  }

  return { processed: pending.length, synced, failed, retried };
}
