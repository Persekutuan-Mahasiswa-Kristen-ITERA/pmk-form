import { listAdminMembers } from "@/app/actions/adminMembers";
import { getAdminUser } from "@/lib/auth";
import { AdminUsersClient } from "@/components/AdminUsersClient";
import { AccessDeniedCard } from "@/components/access-denied";
import { PageHeader } from "@/components/page-header";
import { PICORE_URL } from "@/lib/picore";

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
        subtitle="Daftar undangan admin (cara lama). Admin baru diatur di PI-CORE → Integrasi."
      />

      <div className="rounded-2xl border border-accent/30 bg-[#FAF6F0] p-4 text-sm leading-relaxed text-foreground">
        <p className="font-semibold">Admin pmk-form sekarang diatur di PI-CORE.</p>
        <p className="mt-1 text-muted-foreground">
          Tambahkan admin baru di{" "}
          <a
            href={`${PICORE_URL}/integrations/form`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline underline-offset-2"
          >
            PI-CORE → Integrasi → pmk-form
          </a>
          : per anggota, atau otomatis lewat role, posisi atau unit di periode aktif. Daftar undangan di bawah
          adalah cara lama dan tetap berlaku sampai dihapus.
        </p>
      </div>

      <AdminUsersClient members={members} currentUserId={admin.id} />
    </div>
  );
}
