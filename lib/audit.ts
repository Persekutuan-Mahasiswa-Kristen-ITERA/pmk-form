import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/auth";
import type { AdminUser } from "@/lib/auth";

/**
 * Audit log helper terpusat (Fase 7 item 5).
 *
 * !!! KEAMANAN:
 *   - `import "server-only"` — tidak bisa diimpor dari Client Component.
 *   - Actor (id + email) diambil dari SESI server (getAdminUser), BUKAN dari
 *     payload client. Admin tidak bisa mencatat aksi atas nama admin lain.
 *   - Tabel append-only: tidak ada policy UPDATE/DELETE (migration 009/012),
 *     jadi baris audit tidak bisa diubah atau dihapus lewat aplikasi.
 *
 * Best-effort: kegagalan menulis audit TIDAK menggagalkan aksi utama
 * (mis. form tetap terhapus walau audit gagal tercatat). Log ke server console
 * supaya kelihatan di Vercel, tapi tetap lempar error bila dipanggil eksplisit
 * oleh pemanggil yang ingin transaksi atomic.
 *
 * Aksi yang diizinkan: lihat CHECK constraint migration 012.
 */

export type AuditAction =
  | "invite"
  | "reinvite"
  | "update_role"
  | "activate"
  | "disable"
  | "delete"
  | "self_link"
  | "form_create"
  | "form_update"
  | "form_delete"
  | "form_duplicate"
  | "form_toggle"
  | "response_delete"
  | "response_status_update"
  | "sheets_config_save";

/**
 * Catat satu aksi admin. Lempar error bila insert gagal.
 *
 * Pakai ini di dalam server action SETELAH aksi utama berhasil, saat Anda
 * ingin audit wajib tercatat. Untuk best-effort, pakai `auditBestEffort`.
 */
export async function audit(
  action: AuditAction,
  detail: Record<string, unknown> = {},
  targetEmail: string | null = null
): Promise<void> {
  // Actor dari sesi server, bukan payload client (lihat docstring).
  const actor = await resolveActor();

  const supabase = await createClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_user_id: actor.id,
    actor_email: actor.email ?? null,
    action,
    target_email: targetEmail,
    detail,
  });

  if (error) {
    throw new Error(`Gagal mencatat audit log: ${error.message}`);
  }
}

/**
 * Versi best-effort: catat audit, tapi LEMPAR informasi tambahan tidak.
 * Kegagalan dicatat di server console saja.
 *
 * Dipakai untuk aksi di mana audit adalah "nice to have" (mis. toggle form) —
 * aksi utama tidak boleh gagal hanya karena audit gagal.
 *
 * !!! CATATAN JUJUR: kegagalan audit berarti jejak hilang. Pakai `audit()`
 * saja untuk aksi sensitif (delete form, delete respons).
 */
export async function auditBestEffort(
  action: AuditAction,
  detail: Record<string, unknown> = {},
  targetEmail: string | null = null
): Promise<void> {
  try {
    await audit(action, detail, targetEmail);
  } catch (err) {
    console.error(
      `[audit] gagal mencatat aksi "${action}"`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Baca audit log (admin saja) — untuk halaman viewer.
 *
 * !!! Urutan: terbaru dulang. Target_email & detail disertakan untuk konteks.
 */
export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const admin = await getAdminUser();
  if (!admin) {
    throw new Error("Anda tidak memiliki izin admin.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select(
      "id, actor_user_id, actor_email, action, target_email, detail, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Gagal memuat audit log: ${error.message}`);
  }
  return (data ?? []) as AuditEntry[];
}

/** Satu baris audit log (bentuk untuk UI). */
export interface AuditEntry {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  target_email: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

// `actor` dipakai di `audit()` di atas; resolved per panggilan supaya selalu
// segar (tidak caching di module level — bisa bocor antar request).
async function resolveActor(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) {
    throw new Error("Anda tidak memiliki izin admin.");
  }
  return admin;
}
