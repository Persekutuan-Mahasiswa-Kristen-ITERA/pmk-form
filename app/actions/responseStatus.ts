"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ResponseStatus } from "@/types/forms";

/**
 * Server action update status respons (Fase 7-3).
 *
 * !!! KEAMANAN: requireAdmin() di server. Pendaftar TIDAK bisa mengubah
 * status jawabannya sendiri — RLS policy "Admins can update response status"
 * (migration 011) jadi pertahanan kedua di level database.
 *
 * Migration 011 belum dijalankan? UPDATE gagal dengan 42703 (undefined_column)
 * — dilaporkan ke admin, tidak diam-diam.
 */

const VALID_STATUSES: ResponseStatus[] = ["diterima", "tidak_lolos", "cadangan"];

const UpdateStatusSchema = z.object({
  responseId: z.string().uuid(),
  formId: z.string().uuid(),
  status: z.enum(VALID_STATUSES as [ResponseStatus, ...ResponseStatus[]]).nullable(),
});

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

/** Update status satu respons. null = reset ke "belum diproses". */
export async function updateResponseStatusAction(input: UpdateStatusInput) {
  await requireAdmin();

  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Input tidak valid." };
  }
  const { responseId, formId, status } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("form_responses")
    .update({ status })
    .eq("id", responseId)
    .eq("form_id", formId);

  if (error) {
    // 42703 = undefined_column: migration 011 belum dijalankan.
    if (error.code === "42703") {
      return {
        success: false as const,
        error: "Kolom status belum ada. Jalankan migration 011.",
      };
    }
    console.error("Gagal update status respons", error.message);
    return { success: false as const, error: "Gagal memperbarui status." };
  }

  revalidatePath(`/admin/forms/${formId}/responses`);
  return { success: true as const };
}

/**
 * Bulk update status beberapa respons sekaligus (Fase 7-3).
 *
 * Batched: satu panggilan untuk N baris. Idempoten — nilai sama tidak
 * menimbulkan error. Admin saja.
 */
export async function bulkUpdateStatusAction(
  formId: string,
  responseIds: string[],
  status: ResponseStatus | null
) {
  await requireAdmin();

  if (!Array.isArray(responseIds) || responseIds.length === 0) {
    return { success: false as const, error: "Tidak ada respons dipilih." };
  }
  if (status !== null && !VALID_STATUSES.includes(status)) {
    return { success: false as const, error: "Status tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("form_responses")
    .update({ status })
    .in("id", responseIds)
    .eq("form_id", formId);

  if (error) {
    if (error.code === "42703") {
      return {
        success: false as const,
        error: "Kolom status belum ada. Jalankan migration 011.",
      };
    }
    console.error("Gagal bulk update status", error.message);
    return { success: false as const, error: "Gagal memperbarui status." };
  }

  revalidatePath(`/admin/forms/${formId}/responses`);
  return { success: true as const, count: responseIds.length };
}
