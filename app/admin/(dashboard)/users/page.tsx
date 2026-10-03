import { listAdminMembers } from "@/app/actions/adminMembers";
import { getAdminUser } from "@/lib/auth";
import { AdminUsersClient } from "@/components/AdminUsersClient";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-t-8 border-t-destructive shadow-xl bg-white rounded-3xl">
          <CardContent className="space-y-6 text-center pt-10 pb-10">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-bold">Akses Ditolak</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Halaman ini hanya untuk super admin. Hubungi super admin jika Anda merasa ini kekeliruan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const members = await listAdminMembers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manajemen Admin</h1>
        <p className="text-muted-foreground">
          Undang, aktifkan, atau hapus admin. Akses dikendalikan oleh allowlist (default-deny).
        </p>
      </div>

      <AdminUsersClient members={members} currentUserId={admin.id} />
    </div>
  );
}
