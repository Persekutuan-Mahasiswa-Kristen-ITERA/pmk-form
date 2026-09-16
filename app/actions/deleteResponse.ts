"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateFormAdminData } from "@/app/actions/revalidate";

/** Server action untuk menghapus sebuah respons form (dipakai admin). */
export async function deleteFormResponseAction(responseId: string, formId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("form_responses").delete().eq("id", responseId);

    if (error) throw new Error(error.message);

    await revalidateFormAdminData(formId);
    return { success: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus respons.";
    return { success: false as const, error: message };
  }
}
