import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin identity derived from the current request session.
 *
 * Authorization model: a user is an admin if PI-CORE gives them the app role `admin` for app
 * `form` (PI-CORE > Integrasi > pmk-form, D-16), or they have an ACTIVE row in the legacy
 * invite list `form.admin_members`.
 * This is DEFAULT-DENY — an authenticated user with no allowlist row (or a
 * DISABLED row) has no admin access at all.
 *
 * Sumber kebenaran dipindah dari `user_roles` (Fase 1) ke `admin_members`
 * lewat migration 009. `user_roles` TIDAK di-drop (aturan), hanya tidak lagi
 * dibaca di sini.
 *
 * Penautan `user_id` saat login pertama dilakukan oleh fungsi DB
 * `form.link_admin_user_id()` (SECURITY DEFINER, tanpa parameter), dipanggil
 * dari getAdminAccess(). Aplikasi TIDAK pernah menulis user_id dari payload
 * client. Login memakai akun PI-CORE (project Supabase yang sama).
 *
 * Per-division scoping (divisi_admin) sengaja TIDAK dienforce (keputusan
 * Fase 4A + Checkpoint 5.0 #7: satu level admin). Kolom `role` disimpan
 * untuk masa depan.
 */
export interface AdminUser {
  /** auth.users id */
  id: string;
  /** auth.users email (may be undefined for providers that omit it) */
  email?: string;
  /** admin_members.role — saat ini semua super_admin (satu level) */
  role: string;
  /** admin_members.email — email allowlist (sumber kebenaran) */
  memberEmail: string;
  /** admin_members.status — selalu 'active' bila admin ter-resolusi */
  status: string;
}

/** Why a signed-in person is not let into the admin area (shown on the 403 screen). */
export type AdminDenial =
  | "not_signed_in"
  | "no_member" // a login without a PI-CORE member row
  | "inactive" // PI-CORE member deactivated
  | "must_change_password" // still on PI-CORE's temporary password
  | "not_admin"; // no active form.admin_members row

export type AdminAccess = { admin: AdminUser; denial: null } | { admin: null; denial: AdminDenial };

/**
 * Resolve admin access for the current request.
 *
 * Login is PI-CORE's Supabase Auth (same project, schema `form` for pmk-form). Order:
 *   1. a session must exist;
 *   2. the caller's PI-CORE member row must exist, be active, and not be on a temporary password
 *      (form.my_picore_status() reports on the caller only);
 *   3. an ACTIVE form.admin_members row linked to this account. An invite (user_id still NULL) is
 *      linked here by form.link_admin_user_id(), which matches the account's VERIFIED email; the app
 *      never chooses which row gets linked.
 * RLS (form.is_admin()) enforces the same rules again in the database.
 *
 * Wrapped in React cache(): request-scoped, so several checks in one request cost one round trip.
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { admin: null, denial: "not_signed_in" };

  const { data: status } = await supabase.rpc("my_picore_status").maybeSingle<{
    has_member: boolean;
    is_active: boolean;
    must_change_password: boolean;
  }>();
  if (!status?.has_member) return { admin: null, denial: "no_member" };
  if (!status.is_active) return { admin: null, denial: "inactive" };
  if (status.must_change_password) return { admin: null, denial: "must_change_password" };

  // PI-CORE > Integrasi > pmk-form (D-16): the app role `admin` is enough on its own.
  const { data: appRoles } = await supabase.schema("public").rpc("my_app_roles", { p_app: "form" });
  if (Array.isArray(appRoles) && appRoles.includes("admin")) {
    return {
      admin: {
        id: user.id,
        email: user.email,
        role: "super_admin", // one admin level (see above)
        memberEmail: (user.email ?? "").toLowerCase(),
        status: "active",
      },
      denial: null,
    };
  }

  // Legacy invite list (form.admin_members), still honoured while admins move to PI-CORE.
  const loadMember = () =>
    supabase
      .from("admin_members")
      .select("id, email, role, status, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

  let { data: member } = await loadMember();
  if (!member) {
    // First login after an invite: link by verified email, then read again.
    await supabase.rpc("link_admin_user_id");
    ({ data: member } = await loadMember());
  }

  // Fail closed: no row, or an 'invited'/'disabled' row, is not an admin.
  if (!member || member.status !== "active") return { admin: null, denial: "not_admin" };

  return {
    admin: {
      id: user.id,
      email: user.email,
      role: member.role,
      memberEmail: member.email,
      status: member.status,
    },
    denial: null,
  };
});

/**
 * Resolve the admin identity for the current request, or `null` when the caller is not an
 * active admin for any reason (see getAdminAccess for the reason).
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => (await getAdminAccess()).admin);

/**
 * Require an admin session for a server action / route handler.
 * Throws when the caller is unauthenticated or has no ACTIVE `admin_members`
 * row. The thrown message is safe to surface to the client.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) {
    throw new Error("Anda tidak memiliki izin admin.");
  }
  return admin;
}

/**
 * Require a super_admin session (Fase 5).
 *
 * Kebijakan Checkpoint 5.0 #7 + 4A: saat ini SEMUA admin adalah super_admin
 * (satu level). Fungsi ini tetap disiapkan agar API siap jika kelak ada
 * jenjang, dan dipakai di halaman/server action `/admin/users`.
 */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    throw new Error("Aksi ini memerlukan izin super admin.");
  }
  return admin;
}
