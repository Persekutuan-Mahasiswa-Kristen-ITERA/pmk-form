import Link from "next/link";
import { Home, FileStack, ShieldAlert, Users } from "lucide-react";
import Image from "next/image";
import { PMK_LOGO_URL } from "@/components/PMKLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { getAdminUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Default-deny: `proxy.ts` already redirects unauthenticated users to
  // /admin/login, so reaching this branch without an admin row means the user
  // is logged in but is not an admin. We render a 403 instead of redirecting
  // (redirecting to /admin/login would bounce back here for logged-in users).
  const admin = await getAdminUser();

  if (!admin) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-8 border-t-destructive shadow-2xl bg-white rounded-3xl z-10">
          <CardContent className="space-y-6 text-center pt-10 pb-10">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-bold text-foreground">Akses Ditolak</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Akun Anda tidak terdaftar sebagai admin. Hubungi super admin jika Anda merasa ini adalah kekeliruan.
              </p>
            </div>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-accent/20 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-8 max-w-7xl">
          <div className="flex items-center gap-8 lg:gap-12">
            <Link href="/admin/dashboard" className="flex items-center gap-3 transition-transform hover:scale-105">
              <div className="bg-primary/5 p-1.5 rounded-full border border-accent/30 shadow-sm">
                <Image src={PMK_LOGO_URL} alt="PMK Logo" width={36} height={36} className="drop-shadow-sm" priority />
              </div>
              <span className="hidden sm:inline-block font-serif font-bold text-xl text-primary tracking-tight">PMK Admin</span>
            </Link>

            <nav className="flex items-center space-x-1 md:space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              <Link
                href="/admin/dashboard"
                className="transition-colors hover:bg-highlight hover:text-primary text-foreground flex items-center px-4 py-2.5 rounded-xl font-medium text-sm border border-transparent hover:border-accent/40 whitespace-nowrap"
              >
                <Home className="w-4 h-4 mr-2 opacity-80 flex-shrink-0" />
                Dashboard
              </Link>
              <Link
                href="/admin/forms"
                className="transition-colors hover:bg-highlight hover:text-primary text-foreground flex items-center px-4 py-2.5 rounded-xl font-medium text-sm border border-transparent hover:border-accent/40 whitespace-nowrap"
              >
                <FileStack className="w-4 h-4 mr-2 opacity-80 flex-shrink-0" />
                Formulir
              </Link>
              {admin.role === "super_admin" && (
                <Link
                  href="/admin/users"
                  className="transition-colors hover:bg-highlight hover:text-primary text-foreground flex items-center px-4 py-2.5 rounded-xl font-medium text-sm border border-transparent hover:border-accent/40 whitespace-nowrap"
                >
                  <Users className="w-4 h-4 mr-2 opacity-80 flex-shrink-0" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center">
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8 lg:p-12 container mx-auto max-w-7xl w-full">
        {children}
      </main>
    </div>
  );
}