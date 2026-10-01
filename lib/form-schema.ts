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

      default:
        // text, short_text, long_text, number, email, phone, url, address,
        // date, datetime — all submitted as strings.
        shape[field.id] = field.required
          ? z.string().min(1, `${field.label} wajib diisi.`)
          : z.string().nullish();
    }
  }

  return z.object(shape);
}
