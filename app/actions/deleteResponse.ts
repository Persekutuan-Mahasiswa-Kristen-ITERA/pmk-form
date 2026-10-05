"use server";

import { deleteFormResponse } from "@/lib/forms";
import { audit } from "@/lib/audit";
import { revalidateFormAdminData } from "@/app/actions/revalidate";

/**
 * Server action untuk menghapus sebuah respons form (dipakai admin).
 *
 * F2-1: memanggil data-access layer (deleteFormResponse) yang sudah
 * requireAdmin() — bukan query inline.
 */
export async function deleteFormResponseAction(responseId: string, formId: string) {
  try {
    await deleteFormResponse(responseId);
    // Audit: delete respons sensitif (data PII hilang) -> audit() wajib.
    // Detail minimal: hanya id, bukan jawaban (detail jsonb ikut terlihat
    // oleh admin lain yang membuka halaman audit).
    await audit("response_delete", { response_id: responseId, form_id: formId });
    await revalidateFormAdminData(formId);
    return { success: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus respons.";
    return { success: false as const, error: message };
  }
}
