import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin identity derived from the current request session.
 *
 * Authorization model (Fase 5): a user is an admin if and only if they have
 * an ACTIVE row in `public.admin_members` (email allowlist, invite-only).
 * This is DEFAULT-DENY — an authenticated user with no allowlist row (or a
 * DISABLED row) has no admin access at all.
 *
 * Sumber kebenaran dipindah dari `user_roles` (Fase 1) ke `admin_members`
 * lewat migration 009. `user_roles` TIDAK di-drop (aturan), hanya tidak lagi
 * dibaca di sini.
 *
 * Penautan `user_id` saat login pertama dilakukan oleh fungsi DB
 * `link_admin_user_id()` (SECURITY DEFINER, tanpa parameter — lihat
 * migration 009 LANGKAH 5), dipanggil dari /auth/callback. Aplikasi TIDAK
 * pernah menulis user_id dari payload client.
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

/**
 * Resolve the admin identity for the current request.
 * Returns `null` when the request is unauthenticated OR the authenticated user
 * has no ACTIVE `admin_members` row. Callers that must distinguish those two
 * cases can check the raw session first.
 *
 * FASE 2: dibungkus React `cache()`. Di App Router `cache()` bersifat
 * REQUEST-SCOPED (tidak module-scoped), jadi hasilnya hanya di-share di dalam
 * satu request yang sama dan TIDAK menyebarkan identitas antar request yang
 * berbeda. Efeknya: beberapa panggilan `requireAdmin()` dalam satu request
 * (render server component + server action, mis. layout admin + halaman)
 * hanya melakukan SATU round-trip `auth.getUser()` + query `admin_members`.
 *
 * Semantik default-deny TIDAK berubah: `cache()` hanya mengingat hasil
 * (termasuk `null`), jadi user tanpa baris aktif tetap ditolak di setiap cek.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member, error } = await supabase
    .from("admin_members")
    .select("id, email, role, status, user_id")
    .eq("user_id", user.id)
    .single();

  // No allowlist row (PGRST116) or any other failure = not an admin. Fail closed.
  if (error || !member) return null;

  // Double-check status di level aplikasi juga (defense-in-depth bersama RLS):
  // baris 'invited'/'disabled' bukan admin aktif.
  if (member.status !== "active") return null;

  return {
    id: user.id,
    email: user.email,
    role: member.role,
    memberEmail: member.email,
    status: member.status,
  };
});

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
