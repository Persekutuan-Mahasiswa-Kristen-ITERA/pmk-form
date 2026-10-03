"use server";

import { revalidatePath } from "next/cache";

/** Revalidate generic form routes after a form configuration is changed. */
export async function revalidateForm(slug: string) {
  revalidatePath(`/form/${slug}`);
  revalidatePath(`/`);
  revalidatePath(`/admin/forms`);
  revalidatePath(`/admin/dashboard`);
}

/** Revalidate admin pages after a generic form response is created or changed. */
export async function revalidateFormAdminData(formId?: string) {
  revalidatePath(`/admin/dashboard`);
  revalidatePath(`/admin/forms`);

  if (formId) {
    revalidatePath(`/admin/forms/${formId}/responses`);
  }
}
