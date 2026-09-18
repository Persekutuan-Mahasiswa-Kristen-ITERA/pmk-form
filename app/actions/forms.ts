"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateForm } from "@/app/actions/revalidate";
import type { Form } from "@/types/forms";

type FormPayload = Omit<Form, "id" | "created_at" | "updated_at">;

export async function createFormAction(payload: FormPayload) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("forms").insert(payload).select("id, slug").single();
    if (error) throw new Error(error.message);
    await revalidateForm(payload.slug);
    return { success: true as const, data };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal membuat form." };
  }
}

export async function updateFormAction(id: string, payload: Partial<FormPayload>) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("forms")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    if (payload.slug) await revalidateForm(payload.slug);
    return { success: true as const, data };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal memperbarui form." };
  }
}
