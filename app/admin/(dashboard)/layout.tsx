import { ShieldAlert } from "lucide-react";
import { PMKLogo } from "@/components/PMKLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { getAdminUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Default-deny: `proxy.ts` already redirects unauthenticated users to
  // /admin/login, so reaching this branch without an admin row means the user
  // is logged in but is not an admin. We render a 403 instead of redirecting
  // (redirecting to /admin/login would bounce back here for logged-in users).
  const admin = await getAdminUser();

  if (!admin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Card className="z-10 w-full max-w-md rounded-3xl border-t-8 border-t-destructive bg-white shadow-2xl">
          <CardContent className="space-y-6 pt-10 pb-10 text-center">
            <PMKLogo size={64} className="border-2" />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-bold text-foreground">Akses Ditolak</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Akun Anda tidak terdaftar sebagai admin. Hubungi super admin jika Anda merasa ini adalah kekeliruan.
              </p>
            </div>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}