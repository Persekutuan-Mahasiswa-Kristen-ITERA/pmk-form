import { ShieldAlert } from "lucide-react";
import { PMKLogo } from "@/components/PMKLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { getAdminAccess, type AdminDenial } from "@/lib/auth";
import { PICORE_CHANGE_PASSWORD_URL } from "@/lib/picore";
import { Card, CardContent } from "@/components/ui/card";
import { AdminShell } from "@/components/admin-shell";

const DENIAL_TEXT: Record<AdminDenial, string> = {
  not_signed_in: "Silakan masuk dengan akun PI-CORE Anda.",
  no_member: "Akun ini belum terhubung ke data anggota di PI-CORE. Hubungi admin PI-CORE.",
  inactive: "Keanggotaan Anda di PI-CORE sedang nonaktif, jadi akses admin form ditutup.",
  must_change_password: "Anda masih memakai password sementara. Ganti password dulu di PI-CORE, lalu masuk lagi ke sini.",
  not_admin: "Akun Anda belum diundang sebagai admin form. Minta admin form mengundang email akun PI-CORE Anda.",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Default-deny: `proxy.ts` already redirects unauthenticated users to
  // /admin/login, so reaching this branch without an admin row means the user
  // is logged in but is not an admin. We render a 403 instead of redirecting
  // (redirecting to /admin/login would bounce back here for logged-in users).
  const { admin, denial } = await getAdminAccess();

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
              <p className="text-sm leading-relaxed text-muted-foreground">{DENIAL_TEXT[denial]}</p>
            </div>
            {denial === "must_change_password" && (
              <a
                href={PICORE_CHANGE_PASSWORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Ganti password di PI-CORE
              </a>
            )}
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}