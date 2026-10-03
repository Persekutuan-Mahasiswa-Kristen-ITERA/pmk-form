"use server";

import { createForm, updateForm } from "@/lib/forms";
import { revalidateForm } from "@/app/actions/revalidate";
import type { Form } from "@/types/forms";

type FormPayload = Omit<Form, "id" | "created_at" | "updated_at">;

// F2-1: server action memanggil data-access layer (lib/forms) alih-alih
// menulis query inline. createForm/updateForm sudah memanggil requireAdmin()
// dan melempar error dengan pesan yang aman ditampilkan ke client.

export async function createFormAction(payload: FormPayload) {
  try {
    const data = await createForm(payload);
    await revalidateForm(payload.slug);
    return { success: true as const, data };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal membuat form." };
  }
}

export async function updateFormAction(id: string, payload: Partial<FormPayload>) {
  try {
    const data = await updateForm(id, payload);
    if (payload.slug) await revalidateForm(payload.slug);
    return { success: true as const, data };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal memperbarui form." };
  }
}
