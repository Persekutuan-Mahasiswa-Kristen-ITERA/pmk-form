"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkDuplicateResponse, isFormActive, resolveFormFields, normalizeNim } from "@/lib/forms";
import { syncOne } from "@/lib/sheets/sync";
import { buildFormSchema } from "@/lib/form-schema";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { revalidateFormAdminData } from "@/app/actions/revalidate";
import type { FormSettings } from "@/types/forms";

const SubmitInputSchema = z.object({
  formId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  // Fase 7-2: token Cloudflare Turnstile (sekali pakai). Wajib bila
  // fitur captcha aktif untuk form ini; divalidasi ke Cloudflare di bawah.
  turnstileToken: z.string().optional(),
});

/**
 * Submit a public form response.
 *
 * This replaces the previous direct client-side INSERT into `form_responses`.
 * All gating and validation now happens server-side:
 *  - the form must exist, be open, and not be past its close date;
 *  - answers are validated with a Zod schema built from the form's own field
 *    config — the client payload is never trusted;
 *  - `settings.max_responses` is enforced before the write is accepted;
 *  - duplicate identity (`field_applicant_nim`) is rejected when the form
 *    collects one.
 *
 * Reads and writes use the service-role client so behaviour is deterministic
 * regardless of the submitter's RLS role (an anonymous submitter cannot read
 * `form_responses`, so counting and duplicate checks must not go through the
 * anon role). The service key never reaches the browser.
 *
 * Returned errors are safe to display to the submitter; internal failures are
 * logged server-side instead.
 */
/**
 * Daftarkan respons ke outbox Google Sheets (Fase 6-3).
 *
 * Murah: satu INSERT. Bila form tidak punya sheets_config atau tabel
 * outbox belum ada (migration 010 belum dijalankan), lewati diam-diam —
 * kegagalan Sheets TIDAK PERNAH menggagalkan submit pendaftar.
 */
async function enqueueSheetsSync(
  supabase: ReturnType<typeof createServiceClient>,
  formId: string,
  responseId: string,
  sheetsConfig: unknown
): Promise<void> {
  // Hanya bila form terintegrasi & aktif.
  if (!sheetsConfig || typeof sheetsConfig !== "object") return;
  const cfg = sheetsConfig as { enabled?: unknown };
  if (cfg.enabled !== true) return;

  try {
    const { error } = await supabase.from("sheets_outbox").insert({
      response_id: responseId,
      form_id: formId,
      status: "pending",
    });
    if (error) {
      // 42P01 (undefined_table) / 42703: migration 010 belum dijalankan.
      // 23505 (unique_violation): baris sudah ada (idempoten) — bukan error.
      if (error.code !== "23505") {
        console.warn("sheets_outbox tidak tersedia; lewati sinkronisasi.", sanitizeForLog(error.code));
      }
    }
  } catch (err) {
    console.warn("Gagal mendaftarkan outbox Sheets (non-fatal).", err instanceof Error ? sanitizeForLog(err.message) : "unknown");
  }
}

/** Ambil kode error pendek saja untuk log (bukan pesan DB lengkap). */
function sanitizeForLog(value: string | undefined): string {
  return (value ?? "unknown").slice(0, 60);
}

/**
 * Jadwalkan sinkronisasi Sheets SETELAH respons dikirim ke pendaftar.
 *
 * `after()` Next.js menjalankan callback di latar belakang setelah response
 * selesai — latency submit TIDAK bertambah. Callback selalu aman: syncOne()
 * menangkap error Google dan hanya mengubah status outbox; .catch() di sini
 * adalah pertahanan terakhir agar tidak ada unhandled rejection.
 */
function scheduleSheetsSync(responseId: string): void {
  after(() => {
    syncOne(responseId).catch((err) => {
      console.warn(
        "sinkronisasi Sheets after() gagal (non-fatal).",
        err instanceof Error ? err.message.slice(0, 120) : "unknown"
      );
    });
  });
}

export async function submitFormResponseAction(input: {
  formId: string;
  answers: Record<string, unknown>;
  turnstileToken?: string;
}) {
  try {
    // Rate limit dasar per IP untuk menghambat spam/brute-force submit.
    // Lihat catatan di lib/rate-limit: in-memory limiter tidak andal lintas
    // instance serverless; ini lapisan pertahanan pertama saja.
    const ip = getClientIp(await headers());
    if (rateLimit(`submit:${ip}`, 10, 60_000)) {
      return {
        success: false as const,
        error: "Terlalu banyak pengiriman. Silakan tunggu beberapa saat.",
      };
    }

    const parsed = SubmitInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Data tidak valid." };
    }
    const { formId, answers, turnstileToken } = parsed.data;

    const supabase = createServiceClient();

    // 1. Load the form and gate it by open state + close date.
    //    Fase 3-2c: gunakan isFormActive agar open_date juga dihormati
    //    (sebelumnya hanya cek is_open + close_date).
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("id, slug, is_open, open_date, close_date, form_fields, settings, sheets_config")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      return { success: false as const, error: "Form tidak ditemukan." };
    }

    if (!isFormActive(form)) {
      return { success: false as const, error: "Form ini sudah ditutup." };
    }

    // Fase 3-2a: pakai resolveFormFields (satu sumber kebenaran dengan renderer)
    // supaya field identitas otomatis divalidasi server-side dan tidak bisa
    // dilewati dengan memodifikasi payload client.
    const fields = resolveFormFields({ form_fields: form.form_fields, settings: form.settings });
    const settings = (form.settings ?? {}) as FormSettings;

    // Fase 7-2: verifikasi Turnstile. Hanya bila fitur dikonfigurasi global
    // (env) DAN diaktifkan per-form. Token divalidasi ke Cloudflare dengan
    // SECRET KEY — client TIDAK bisa memalsukannya.
    // !!! PENTING: kegagalan infrastruktur Cloudflare TIDAK menggagalkan submit
    //     (lihat lib/turnstile.ts), tapi token kosong/expired TETAP ditolak.
    if (settings.require_captcha !== false) {
      const verify = await verifyTurnstileToken(turnstileToken, ip);
      if (!verify.ok) {
        return { success: false as const, error: verify.reason ?? "Verifikasi keamanan gagal." };
      }
    }

    // 2. Validate the answers against the field configuration.
    const formSchema = buildFormSchema(fields);
    const validated = formSchema.safeParse(answers);
    if (!validated.success) {
      const first = validated.error.issues[0];
      return {
        success: false as const,
        error: first?.message ?? "Terdapat jawaban yang tidak valid.",
      };
    }

    // 3. Enforce max_responses before accepting the write. Note this is a
    //    best-effort count check; a concurrent submission can still race it.
    if (typeof settings.max_responses === "number" && settings.max_responses > 0) {
      const { count, error: countError } = await supabase
        .from("form_responses")
        .select("id", { count: "exact", head: true })
        .eq("form_id", formId);

      if (countError) {
        console.error("Gagal menghitung respons (max_responses)", countError.message);
        return {
          success: false as const,
          error: "Gagal memproses permintaan. Silakan coba lagi.",
        };
      }

      if ((count ?? 0) >= settings.max_responses) {
        return { success: false as const, error: "Kuota pengisian form ini sudah penuh." };
      }
    }

    // 4. Duplicate identity check (NIM convention used since the legacy
    //    recruitment flow). Only applied when the form actually has such a
    //    field; generic forms without an identity field allow repeats.
    //
    //    Fase 3-5: nilai yang dihitung juga disimpan ke kolom `nim_normalized`
    //    (migration 008) supaya ada pertahanan kedua di level database.
    //    Normalisasi HARUS sama dengan yang dipakai insert (lihat helper
    //    normalizeNim di bawah).
    const nimField = fields.find((f) => f.id === "field_applicant_nim");
    const nimValue = nimField ? validated.data[nimField.id] : undefined;
    const nimNormalized =
      typeof nimValue === "string" && nimValue.trim() !== ""
        ? normalizeNim(nimValue)
        : null;
    if (nimField && nimNormalized) {
      const duplicate = await checkDuplicateResponse(formId, nimField.id, nimValue as string, supabase);
      if (duplicate) {
        return {
          success: false as const,
          error: "Anda sudah mengirim respons untuk form ini.",
          duplicate: true,
        };
      }
    }

    // 5. Collect attachment URLs from file_upload fields.
    const files: string[] = [];
    for (const field of fields) {
      if (field.type === "file_upload") {
        const value = validated.data[field.id];
        if (typeof value === "string" && value.trim() !== "") files.push(value);
      }
    }

    // 6. Persist. Answers stay keyed by the stable field.id.
    //    Fase 3-5: nim_normalized diisi supaya unique PARTIAL index
    //    (migration 008) bisa menangkap race condition yang lolos dari cek
    //    aplikasi di langkah 4.
    //
    //    Fase 6-3: insert baris sheets_outbox bersamaan (murah, satu request).
    //    Sinkronisasi best-effort dilakukan SETELAH respons dikirim ke user
    //    (after()) — kegagalan Google tidak boleh menggagalkan submit.
    const { data: inserted, error: insertError } = await supabase
      .from("form_responses")
      .insert({
        form_id: formId,
        answers: validated.data,
        files,
        respondent_id: null,
        nim_normalized: nimNormalized,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // 23505 = unique_violation. Paling mungkin: NIM sama dikirim bersamaan
      // (race condition lolos cek aplikasi, ditolak DB).
      if (insertError?.code === "23505") {
        return {
          success: false as const,
          error: "Anda sudah mengirim respons untuk form ini.",
          duplicate: true,
        };
      }
      // 42703 = undefined_column. Migration 008 belum dijalankan.
      // Jangan tolak submit karena kolom opsional; simpan tanpa normalisasi.
      if (insertError?.code === "42703") {
        console.warn("Kolom nim_normalized belum ada; jalankan migration 008.");
        const retry = await supabase
          .from("form_responses")
          .insert({
            form_id: formId,
            answers: validated.data,
            files,
            respondent_id: null,
          })
          .select("id")
          .single();
        if (retry.error || !retry.data) {
          console.error("Gagal menyimpan respons", retry.error?.message);
          return { success: false as const, error: "Gagal menyimpan respons. Silakan coba lagi." };
        }
        await revalidateFormAdminData(formId);
        // Fase 6-3: jalur fallback 008 tetap didaftarkan ke outbox + sync
        // best-effort (perilaku sama dengan jalur utama).
        await enqueueSheetsSync(supabase, formId, retry.data.id, form.sheets_config);
        scheduleSheetsSync(retry.data.id as string);
        return { success: true as const, responseId: retry.data.id as string };
      }
      console.error("Gagal menyimpan respons", insertError?.message);
      return { success: false as const, error: "Gagal menyimpan respons. Silakan coba lagi." };
    }

    await revalidateFormAdminData(formId);

    // Fase 6-3: daftarkan ke outbox Sheets bila form punya konfigurasi.
    // Bila migration 010 belum dijalankan (tabel tidak ada), lewati tanpa
    // menggagalkan submit (42703/42P01 = undefined_column/undefined_table).
    // Sinkronisasi best-effort via after(): tidak menambah latency submit,
    // dan kegagalan Google hanya mengubah status outbox.
    await enqueueSheetsSync(supabase, formId, inserted.id, form.sheets_config);
    scheduleSheetsSync(inserted.id as string);

    return { success: true as const, responseId: inserted.id as string };
  } catch (err) {
    console.error("submitFormResponseAction error", err);
    const message = err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
    return { success: false as const, error: message };
  }
}
