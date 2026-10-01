"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { checkDuplicateResponse } from "@/lib/forms";
import { buildFormSchema } from "@/lib/form-schema";
import { revalidateFormAdminData } from "@/app/actions/revalidate";
import type { FieldConfig, FormSettings } from "@/types/forms";

const SubmitInputSchema = z.object({
  formId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
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
export async function submitFormResponseAction(input: {
  formId: string;
  answers: Record<string, unknown>;
}) {
  try {
    const parsed = SubmitInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Data tidak valid." };
    }
    const { formId, answers } = parsed.data;

    const supabase = createServiceClient();

    // 1. Load the form and gate it by open state + close date.
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("id, slug, is_open, close_date, form_fields, settings")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      return { success: false as const, error: "Form tidak ditemukan." };
    }

    if (!form.is_open || new Date(form.close_date) <= new Date()) {
      return { success: false as const, error: "Form ini sudah ditutup." };
    }

    const fields = (form.form_fields ?? []) as FieldConfig[];
    const settings = (form.settings ?? {}) as FormSettings;

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
    const nimField = fields.find((f) => f.id === "field_applicant_nim");
    const nimValue = nimField ? validated.data[nimField.id] : undefined;
    if (nimField && typeof nimValue === "string" && nimValue.trim() !== "") {
      const duplicate = await checkDuplicateResponse(formId, nimField.id, nimValue, supabase);
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
    const { data: inserted, error: insertError } = await supabase
      .from("form_responses")
      .insert({
        form_id: formId,
        answers: validated.data,
        files,
        respondent_id: null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("Gagal menyimpan respons", insertError?.message);
      return { success: false as const, error: "Gagal menyimpan respons. Silakan coba lagi." };
    }

    await revalidateFormAdminData(formId);

    return { success: true as const, responseId: inserted.id as string };
  } catch (err) {
    console.error("submitFormResponseAction error", err);
    const message = err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
    return { success: false as const, error: message };
  }
}
