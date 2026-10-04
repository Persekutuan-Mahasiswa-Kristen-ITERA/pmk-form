import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  getSheetsConfig,
  ensureHeader,
  appendRows,
  rowExists,
  readExistingIds,
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
 * Sinkronkan SEMUA baris pending satu form dalam SATU panggilan append.
 *
 * Dipakai backfill (tombol "Sinkronkan Semua Respons") dan retry. Paket
 * Hobby hanya mendukung cron harian, jadi backfill tidak boleh menunggu
 * cron — pemrosesan harus langsung. Ratusan respons = 1 request ke Google
 * (plus 1 baca idempotensi + 1 tulis header).
 *
 * Idempoten: response_id yang sudah ada di sheet dilewati (readExistingIds).
 */
export async function syncFormBatch(formId: string): Promise<{
  processed: number;
  synced: number;
  error?: string;
}> {
  const supabase = createServiceClient();

  // Ambil form + config.
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, form_fields, sheets_config")
    .eq("id", formId)
    .single();
  if (formError || !form) {
    return { processed: 0, synced: 0, error: "Form tidak ditemukan." };
  }

  const cfg = getSheetsConfig(form);
  if (!cfg || !cfg.enabled) {
    return { processed: 0, synced: 0, error: "Integrasi Sheets tidak aktif untuk form ini." };
  }

  // Ambil SEMUA baris outbox form ini yang masih perlu dikirim.
  const { data: pending, error: pendingError } = await supabase
    .from("sheets_outbox")
    .select("response_id, attempts")
    .eq("form_id", formId)
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(500);
  if (pendingError || !pending || pending.length === 0) {
    return { processed: 0, synced: 0 };
  }

  // Ambil respons yang bersangkutan.
  const responseIds = pending.map((p) => p.response_id);
  const { data: responses, error: respError } = await supabase
    .from("form_responses")
    .select("id, answers")
    .in("id", responseIds)
    .order("submitted_at", { ascending: true });
  if (respError || !responses) {
    return { processed: responseIds.length, synced: 0, error: "Gagal memuat respons." };
  }

  const fields = (form.form_fields ?? []) as FieldConfig[];

  try {
    // Header dulu (idempoten), lalu kumpulkan id yang sudah ada di sheet.
    await ensureHeader(cfg.spreadsheet_id, cfg.sheet_name, fields);
    const existing = await readExistingIds(cfg.spreadsheet_id, cfg.sheet_name);

    // Baris yang belum ada di sheet.
    const toSync = responses.filter((r) => !existing.has(r.id));
    const syncedNow: string[] = [];

    if (toSync.length > 0) {
      const rows = toSync.map((r) => buildRow(fields, r.answers ?? {}, r.id));
      await appendRows(cfg.spreadsheet_id, cfg.sheet_name, rows);
      syncedNow.push(...toSync.map((r) => r.id));
    }

    // Baris yang sudah ada di sheet langsung ditandai synced (cek ulang).
    const alreadyThere = responses.filter((r) => existing.has(r.id)).map((r) => r.id);
    const markIds = [...syncedNow, ...alreadyThere];

    if (markIds.length > 0) {
      await supabase
        .from("sheets_outbox")
        .update({
          status: "synced",
          last_error: null,
          next_attempt_at: null,
          synced_at: new Date().toISOString(),
        })
        .in("response_id", markIds);
    }

    return { processed: responseIds.length, synced: markIds.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tak dikenal.";
    const nextAttempt = (pending[0]?.attempts ?? 0) + 1;
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
      .in("response_id", responseIds);

    return {
      processed: responseIds.length,
      synced: 0,
      error: sanitizeError(message),
    };
  }
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
