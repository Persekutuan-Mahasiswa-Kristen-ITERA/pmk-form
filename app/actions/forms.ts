"use server";

import {
  createForm,
  updateForm,
  toggleFormOpen,
  deleteForm,
  duplicateForm,
} from "@/lib/forms";
import { audit, auditBestEffort } from "@/lib/audit";
import { revalidateFormAdminData, revalidateForm } from "@/app/actions/revalidate";
import type { Form } from "@/types/forms";

type FormPayload = Omit<Form, "id" | "created_at" | "updated_at">;

// F2-1: server action memanggil data-access layer (lib/forms) alih-alih
// menulis query inline. createForm/updateForm sudah memanggil requireAdmin()
// dan melempar error dengan pesan yang aman ditampilkan ke client.

export async function createFormAction(payload: FormPayload) {
  try {
    const data = await createForm(payload);
    // Audit: create form sensitif -> audit() (wajib tercatat, lempar bila gagal).
    await audit("form_create", { id: data.id, slug: payload.slug, title: payload.title });
    await revalidateForm(payload.slug);
    return { success: true as const, data };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal membuat form." };
  }
}

export async function updateFormAction(id: string, payload: Partial<FormPayload>) {
  try {
    const data = await updateForm(id, payload);
    // Audit: log field yang berubah (slug lama untuk jejak rename).
    await audit("form_update", { id, changed: Object.keys(payload) });
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
    // Best-effort: toggle adalah aksi ringan; audit gagal tak boleh
    // membuat form terkunci. Detail minimal (tidak bocor data responden).
    await auditBestEffort("form_toggle", { id, is_open: isOpen });
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
    // Audit: delete form sensitif -> audit() (lempar bila gagal).
    await audit("form_delete", { id });
    await revalidateFormAdminData();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal menghapus form." };
  }
}

// Fase 7-4: duplikasi form dari kartu admin. duplicateForm (lib) memanggil
// requireAdmin(); hasil selalu is_open=false supaya admin periksa dulu.
// Mengembalikan form baru agar UI bisa langsung arahkan ke halaman editnya.
export async function duplicateFormAction(id: string) {
  try {
    const data = await duplicateForm(id);
    // Audit: catat kedua id supaya jejak hubungan asal<->salinan jelas.
    await audit("form_duplicate", { from: id, to: data.id, slug: data.slug });
    await revalidateFormAdminData();
    return { success: true as const, data };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Gagal menduplikasi form." };
  }
}
