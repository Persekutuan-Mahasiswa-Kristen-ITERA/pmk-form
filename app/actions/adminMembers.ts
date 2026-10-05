"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import { auditBestEffort as audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Server actions manajemen admin (Fase 5-4).
 *
 * Semua aksi memanggil requireSuperAdmin() — otorisasi di SERVER, bukan hanya
 * UI. Sumber kebenaran: public.admin_members (allowlist, invite-only).
 *
 * Guard (Tambahan user): tidak boleh hapus/nonaktifkan diri sendiri, tidak
 * boleh menghapus super_admin terakhir. Guard juga ada di DB; di sini adalah
 * lapisan pertama yang memberi pesan ramah.
 */

export type AdminMember = {
  id: string;
  email: string;
  role: string;
  status: string;
  user_id: string | null;
  created_at: string;
  last_login_at: string | null;
};

const EmailSchema = z.string().email("Email tidak valid.").transform((v) => v.trim().toLowerCase());

const InviteSchema = z.object({
  email: EmailSchema,
  role: z.enum(["super_admin", "divisi_admin"]).default("super_admin"),
});

/** Daftar semua admin (super_admin only). */
export async function listAdminMembers(): Promise<AdminMember[]> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_members")
    .select("id, email, role, status, user_id, created_at, last_login_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Gagal memuat daftar admin.");
  return (data ?? []) as AdminMember[];
}

/**
 * Catat aksi ke audit log.
 *
 * Fase 7 item 5: implementasi dipindahkan ke `lib/audit` (auditBestEffort)
 * supaya audit terpusat. Actor diambil dari sesi server di sana, bukan
 * dikirim dari sini — admin tidak bisa mencatat aksi atas nama admin lain.
 */

/** Invite admin baru by email (status 'invited', aktif saat login pertama). */
export async function inviteAdminAction(input: { email: string; role?: string }) {
  const admin = await requireSuperAdmin();
  const parsed = InviteSchema.safeParse({
    email: input.email,
    role: (input.role ?? "super_admin") as "super_admin" | "divisi_admin",
  });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Email tidak valid." };
  }
  const { email, role } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_members")
    .insert({ email, role, status: "invited", invited_by: admin.id });

  if (error) {
    // 23505 = duplikat (email sudah di-allowlist).
    if (error.code === "23505") {
      return { success: false as const, error: "Email sudah ada di daftar admin." };
    }
    return { success: false as const, error: "Gagal mengundang admin." };
  }

  await audit("invite", { role }, email);
  revalidatePath("/admin/users");
  return { success: true as const };
}

/** Ubah role admin. */
export async function updateAdminRoleAction(id: string, role: string) {
  await requireSuperAdmin();
  if (role !== "super_admin" && role !== "divisi_admin") {
    return { success: false as const, error: "Role tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("admin_members").update({ role }).eq("id", id);
  if (error) return { success: false as const, error: "Gagal mengubah role." };

  const { data: target } = await supabase
    .from("admin_members")
    .select("email")
    .eq("id", id)
    .single();
  await audit("update_role", { role }, target?.email ?? null);
  revalidatePath("/admin/users");
  return { success: true as const };
}

/**
 * Aktifkan/nonaktifkan admin.
 * Guard: tidak boleh menonaktifkan diri sendiri.
 */
export async function setAdminStatusAction(id: string, status: "active" | "disabled") {
  const admin = await requireSuperAdmin();

  const supabase = await createClient();
  const { data: target, error: findError } = await supabase
    .from("admin_members")
    .select("id, email, status, user_id")
    .eq("id", id)
    .single();
  if (findError || !target) {
    return { success: false as const, error: "Admin tidak ditemukan." };
  }

  // Guard: tidak boleh menonaktifkan diri sendiri.
  if (status === "disabled" && target.user_id === admin.id) {
    return { success: false as const, error: "Anda tidak dapat menonaktifkan akun Anda sendiri." };
  }

  const { error } = await supabase.from("admin_members").update({ status }).eq("id", id);
  if (error) return { success: false as const, error: "Gagal mengubah status." };

  await audit(
    status === "disabled" ? "disable" : "activate",
    { from: target.status, to: status },
    target.email
  );
  revalidatePath("/admin/users");
  return { success: true as const };
}

/**
 * Hapus admin dari allowlist.
 * Guard: tidak boleh hapus diri sendiri; tidak boleh hapus super_admin terakhir.
 */
export async function deleteAdminAction(id: string) {
  const admin = await requireSuperAdmin();

  const supabase = await createClient();
  const { data: target, error: findError } = await supabase
    .from("admin_members")
    .select("id, email, role, status, user_id")
    .eq("id", id)
    .single();
  if (findError || !target) {
    return { success: false as const, error: "Admin tidak ditemukan." };
  }

  // Guard 1: tidak boleh menghapus diri sendiri.
  if (target.user_id === admin.id) {
    return { success: false as const, error: "Anda tidak dapat menghapus akun Anda sendiri." };
  }

  // Guard 2: tidak boleh menghapus super_admin aktif terakhir.
  if (target.role === "super_admin" && target.status === "active") {
    const { count } = await supabase
      .from("admin_members")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      return {
        success: false as const,
        error: "Tidak dapat menghapus super admin terakhir. Tambahkan admin lain terlebih dahulu.",
      };
    }
  }

  const { error } = await supabase.from("admin_members").delete().eq("id", id);
  if (error) return { success: false as const, error: "Gagal menghapus admin." };

  await audit("delete", { role: target.role }, target.email);
  revalidatePath("/admin/users");
  return { success: true as const };
}
