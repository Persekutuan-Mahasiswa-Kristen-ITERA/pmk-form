"use server";

import { createForm, updateForm, toggleFormOpen, deleteForm } from "@/lib/forms";
import { revalidateFormAdminData, revalidateForm } from "@/app/actions/revalidate";
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

// Fase 4C: toggle 1-klik buka/tutup dari kartu admin. toggleFormOpen sudah
// memanggil requireAdmin(); revalidate agar badge status langsung berubah.
export async function toggleFormOpenAction(id: string, isOpen: boolean) {
  try {
    await toggleFormOpen(id, isOpen);
    await revalidateFormAdminData();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal mengubah status form." };
  }
}

// Fase 4C: hapus form dari kartu admin. deleteForm (lib) MENOLAK bila form
// punya respons; pesan penolakan itu yang diteruskan ke admin.
export async function deleteFormAction(id: string) {
  try {
    await deleteForm(id);
    await revalidateFormAdminData();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal menghapus form." };
  }
}
