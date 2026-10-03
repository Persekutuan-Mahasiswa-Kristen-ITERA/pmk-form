import { createClient } from "@/lib/supabase/server";

/**
 * Admin identity derived from the current request session.
 *
 * Authorization model (Fase 1): a user is an admin if and only if they have a
 * row in `public.user_roles`. This is DEFAULT-DENY — an authenticated user
 * with no role row has no admin access at all. The previous implementation
 * treated "authenticated without a role row" as super_admin; that fallback was
 * removed because public signups are enabled on this Supabase project.
 *
 * Per-division scoping (divisi_admin) is intentionally NOT enforced yet; it is
 * deferred to Fase 4. Today every role row grants full admin permissions.
 */
export interface AdminUser {
  /** auth.users id */
  id: string;
  /** auth.users email (may be undefined for providers that omit it) */
  email?: string;
  /** user_roles.role — currently informational only */
  role: string;
  /** user_roles.division — currently informational only */
  division: string | null;
}

/**
 * Resolve the admin identity for the current request.
 * Returns `null` when the request is unauthenticated OR the authenticated user
 * has no `user_roles` row. Callers that must distinguish those two cases can
 * check the raw session first.
 *
 * FASE 2 (catatan): pembungkusan dengan React `cache()` direncanakan agar
 * beberapa panggilan `requireAdmin()` / `getAdminUser()` dalam satu request
 * (satu render server component + server action) hanya melakukan SATU round-trip
 * ke Supabase. Saat ini setiap pemanggilan mengulang query user_roles. Tunggu
 * Fase 2 karena perlu verifikasi `cache()` aman dipakai lintas server action
 * (request scope, bukan module scope) dan tidak menyebarkan identitas antar
 * request yang berbeda.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: roleRecord, error } = await supabase
    .from("user_roles")
    .select("id, user_id, role, division, created_at")
    .eq("user_id", user.id)
    .single();

  // No role row (PGRST116) or any other failure = not an admin. Fail closed.
  if (error || !roleRecord) return null;

  return {
    id: user.id,
    email: user.email,
    role: roleRecord.role,
    division: roleRecord.division,
  };
}

/**
 * Require an admin session for a server action / route handler.
 * Throws when the caller is unauthenticated or has no `user_roles` row.
 * The thrown message is safe to surface to the client.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) {
    throw new Error("Anda tidak memiliki izin admin.");
  }
  return admin;
}
