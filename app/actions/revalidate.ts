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

/**
 * Compatibility helpers for the currently active recruitment UI.
 * Keep them until the public and admin routes are converted in later phases.
 */
export async function revalidateRecruitment(slug: string) {
  revalidatePath(`/recruitment/${slug}`);
  revalidatePath(`/`);
}

export async function revalidateAdminData(recruitmentId?: string) {
  revalidatePath(`/admin/dashboard`);
  revalidatePath(`/admin/recruitments`);

  if (recruitmentId) {
    revalidatePath(`/admin/recruitments/${recruitmentId}/applicants`);
  }
}
