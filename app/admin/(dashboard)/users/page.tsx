import { listAdminMembers } from "@/app/actions/adminMembers";
import { getAdminUser } from "@/lib/auth";
import { AdminUsersClient } from "@/components/AdminUsersClient";
import { AccessDeniedCard } from "@/components/access-denied";
import { PageHeader } from "@/components/page-header";

/**
 * Halaman manajemen admin (Fase 5-4).
 *
 * Server Component. requireSuperAdmin() ada di setiap server action (bukan
 * hanya di sini) — pertahanan di level action, bukan cuma halaman.
 */
export const revalidate = 0;

export default async function AdminUsersPage() {
  const admin = await getAdminUser();

  if (!admin || admin.role !== "super_admin") {
    return (
      <AccessDeniedCard message="Halaman ini hanya untuk super admin. Hubungi super admin jika Anda merasa ini kekeliruan." />
    );
  }

  const members = await listAdminMembers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Admin"
        subtitle="Undang, aktifkan, atau hapus admin. Akses dikendalikan oleh allowlist (default-deny)."
      />

      <AdminUsersClient members={members} currentUserId={admin.id} />
    </div>
  );
}
