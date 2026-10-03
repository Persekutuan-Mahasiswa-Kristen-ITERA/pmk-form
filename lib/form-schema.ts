import { z } from "zod";
import type { FieldConfig } from "@/types/forms";

/**
 * Build a Zod object schema from a form's field configuration.
 *
 * This is the SERVER-SIDE source of truth for submission validation. The public
 * renderer builds its own client schema for instant feedback; Fase 3 will unify
 * both onto this single builder. For now both agree on shape: required-ness and
 * the per-type value shape.
 *
 * Optional fields accept `null` because the client normalises empty answers to
 * `null` before calling the server action. Unknown keys are stripped, so only
 * answers for declared fields can ever be persisted.
 */
export function buildFormSchema(fields: FieldConfig[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    switch (field.type) {
      case "file_upload":
        // Files reach the server as already-uploaded public URL strings.
        shape[field.id] = field.required
          ? z.string().min(1, `${field.label} wajib diupload.`)
          : z.string().nullish();
        break;

      case "checkbox":
        if (field.options && field.options.length > 0) {
          shape[field.id] = field.required
            ? z
                .array(z.string())
                .min(1, `Pilih minimal satu opsi untuk ${field.label}.`)
            : z.array(z.string()).nullish();
        } else {
          shape[field.id] = field.required
            ? z
                .boolean()
                .refine((v) => v === true, {
                  message: "Anda harus menyetujui pernyataan ini.",
                })
            : z.boolean().nullish();
        }
        break;

      case "radio":
      case "dropdown":
        shape[field.id] = field.required
          ? z.string().min(1, `${field.label} wajib diisi.`)
          : z.string().nullish();
        break;

      case "email":
        // F2 helper text: optional field menerima null/kosong (client kirim null).
        shape[field.id] = field.required
          ? z.string().min(1, `${field.label} wajib diisi.`).email(`${field.label} harus berupa email yang valid.`)
          : z.string().email(`${field.label} harus berupa email yang valid.`).nullish();
        break;

      case "url":
        shape[field.id] = field.required
          ? z.string().min(1, `${field.label} wajib diisi.`).url(`${field.label} harus berupa URL yang valid.`)
          : z.string().url(`${field.label} harus berupa URL yang valid.`).nullish();
        break;

      case "number":
        shape[field.id] = field.required
          ? z.string().min(1, `${field.label} wajib diisi.`).regex(/^\d+$/, `${field.label} harus berupa angka.`)
          : z.string().regex(/^\d*$/, `${field.label} harus berupa angka.`).nullish();
        break;

      default:
        // text, short_text, long_text, phone, address, date, datetime —
        // semua dikirim sebagai string.
        shape[field.id] = field.required
          ? z.string().min(1, `${field.label} wajib diisi.`)
          : z.string().nullish();
    }

    // Fase 3-2c: terapkan validation opsional (dari builder) pada field string.
    // Dilakukan setelah switch supaya semua tipe string bisa divalidasi.
    const v = field.validation;
    if (v) {
      const current = shape[field.id];
      if (current instanceof z.ZodString) {
        let chain = current;
        if (typeof v.minLength === "number") {
          chain = chain.min(v.minLength, v.customMessage ?? `${field.label} minimal ${v.minLength} karakter.`);
        }
        if (typeof v.maxLength === "number") {
          chain = chain.max(v.maxLength, v.customMessage ?? `${field.label} maksimal ${v.maxLength} karakter.`);
        }
        if (v.pattern) {
          chain = chain.regex(new RegExp(v.pattern), v.patternMessage ?? v.customMessage ?? `${field.label} format tidak valid.`);
        }
        shape[field.id] = chain;
      }
    }
  }

  return z.object(shape);
}
