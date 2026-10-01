import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Form,
  FormResponse,
  FormResponseInput,
  UserRoleRecord,
  PermissionCheck,
  FormType,
} from "@/types/forms";

// ==========================================
// FORMS — CRUD service
// ==========================================

/** Fetch all open forms for the public landing page. */
export async function getOpenForms(): Promise<Form[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("is_open", true)
    .lte("open_date", new Date().toISOString())
    .gte("close_date", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat form: ${error.message}`);
  return (data ?? []) as Form[];
}

/** Fetch a single form by slug (public). */
export async function getFormBySlug(slug: string): Promise<Form | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(`Gagal memuat form: ${error.message}`);
  }
  return data as Form;
}

/** Fetch a single form by id (admin). */
export async function getFormById(id: string): Promise<Form | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Gagal memuat form: ${error.message}`);
  }
  return data as Form;
}

/** Fetch all forms (admin dashboard). */
export async function getAllForms(options?: {
  formType?: FormType;
  page?: number;
  pageSize?: number;
}): Promise<{ data: Form[]; count: number }> {
  const supabase = await createClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("forms")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (options?.formType) {
    query = query.eq("form_type", options.formType);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Gagal memuat daftar form: ${error.message}`);
  return { data: (data ?? []) as Form[], count: count ?? 0 };
}

/** Count active (open) forms — for admin dashboard stats. */
export async function countActiveForms(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("forms")
    .select("id", { count: "exact", head: true })
    .eq("is_open", true);

  if (error) throw new Error(`Gagal menghitung form aktif: ${error.message}`);
  return count ?? 0;
}

/** Create a new form (admin). Returns the new row. */
export async function createForm(
  payload: Omit<Form, "id" | "created_at" | "updated_at">
): Promise<Form> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Gagal membuat form: ${error.message}`);
  return data as Form;
}

/** Update an existing form (admin). */
export async function updateForm(
  id: string,
  payload: Partial<Omit<Form, "id" | "created_at">>
): Promise<Form> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Gagal mengupdate form: ${error.message}`);
  return data as Form;
}

/** Toggle is_open (admin). */
export async function toggleFormOpen(
  id: string,
  isOpen: boolean
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("forms")
    .update({ is_open: isOpen, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Gagal mengubah status form: ${error.message}`);
}

/** Delete a form and its responses (admin). */
export async function deleteForm(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("forms").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus form: ${error.message}`);
}

// ==========================================
// FORM RESPONSES — CRUD service
// ==========================================

/** Submit a new form response (public). */
export async function submitFormResponse(
  input: FormResponseInput
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_responses")
    .insert({
      form_id: input.form_id,
      answers: input.answers,
      files: input.files ?? [],
      respondent_id: input.respondent_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Gagal menyimpan respons: ${error.message}`);
  return { id: data.id };
}

/** Get paginated responses for a form (admin). */
export async function getFormResponses(
  formId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{ data: FormResponse[]; count: number }> {
  const supabase = await createClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("form_responses")
    .select("*", { count: "exact" })
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Gagal memuat respons: ${error.message}`);
  return { data: (data ?? []) as FormResponse[], count: count ?? 0 };
}

/** Get ALL responses for a form (used for CSV/ZIP export). */
export async function getAllFormResponses(
  formId: string
): Promise<FormResponse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_responses")
    .select("*")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(`Gagal mengambil semua respons: ${error.message}`);
  return (data ?? []) as FormResponse[];
}

/** Count responses for a form. */
export async function countFormResponses(formId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);

  if (error) throw new Error(`Gagal menghitung respons: ${error.message}`);
  return count ?? 0;
}

/**
 * Check for a duplicate response using a specific field value.
 * Useful for preventing the same NIM from submitting twice.
 *
 * An optional `client` can be supplied when the caller already holds a client
 * (e.g. the submission server action, which uses the service-role client so
 * that the check works for anonymous submitters too).
 */
export async function checkDuplicateResponse(
  formId: string,
  fieldId: string,
  value: string,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const { count, error } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId)
    .contains("answers", { [fieldId]: value });

  if (error) return false; // fail-open for now; prevent blocking a real submission
  return (count ?? 0) > 0;
}

/** Delete a single response (admin). */
export async function deleteFormResponse(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_responses")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Gagal menghapus respons: ${error.message}`);
}

// ==========================================
// USER ROLES — service
// ==========================================

/** Get the role for the current authenticated user. Returns null if no role row. */
export async function getCurrentUserRole(): Promise<UserRoleRecord | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) return null; // no role row = not yet assigned
  return data as UserRoleRecord;
}

/**
 * Derive permissions for the current request.
 *
 * DEFAULT-DENY: an authenticated user with no `user_roles` row gets no
 * permissions. The old implementation fell back to super_admin for any
 * authenticated user, which is unsafe now that public signups are enabled.
 *
 * Per-division scoping (divisi_admin) is deferred to Fase 4; today every
 * role row grants full admin permissions.
 */
export async function getCurrentUserPermissions(): Promise<PermissionCheck> {
  const admin = await getAdminUser();

  if (!admin) {
    return {
      canViewForms: false,
      canCreateForms: false,
      canEditForm: false,
      canDeleteForm: false,
      canViewResponses: false,
      canDeleteResponses: false,
      canExportResponses: false,
    };
  }

  return {
    canViewForms: true,
    canCreateForms: true,
    canEditForm: true,
    canDeleteForm: true,
    canViewResponses: true,
    canDeleteResponses: true,
    canExportResponses: true,
    division: admin.division,
  };
}

/** List all user roles (super_admin only). */
export async function getAllUserRoles(): Promise<UserRoleRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat daftar role: ${error.message}`);
  return (data ?? []) as UserRoleRecord[];
}

/** Upsert a role for a user (super_admin only). */
export async function upsertUserRole(
  userId: string,
  role: UserRoleRecord["role"],
  division?: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").upsert(
    { user_id: userId, role, division: division ?? null },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Gagal menyimpan role: ${error.message}`);
}

/** Remove a role row (super_admin only). */
export async function removeUserRole(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`Gagal menghapus role: ${error.message}`);
}
