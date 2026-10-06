import Link from "next/link";
import { Home, FileStack, Users, ScrollText } from "lucide-react";
import { PMKLogo } from "@/components/PMKLogo";
import { getAdminUser } from "@/lib/auth";
import { AdminNav, type NavItem } from "@/components/admin-nav";

/**
 * AdminShell — navbar admin responsif (UI Overhaul U1).
 *
 * Desktop (>= lg): navbar sticky putih, tinggi ~56px, logo + "PMK Admin" +
 * "Portal Formulir & Pelayanan" + menu ikon + identitas user + Keluar.
 *
 * Mobile (< lg): bar ringkas (logo + "PMK Admin" + tombol menu); menu,
 * identitas user, dan Keluar masuk ke drawer `Sheet` sisi kiri (keputusan
 * U0-a). Item menu min-height 44px (target sentuh).
 *
 * Otorisasi TIDAK ADA di sini — tetap di layout (`getAdminUser`) + server
 * action; shell ini hanya presentasi.
 */
export const navItems: readonly NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Home },
  { href: "/admin/forms", label: "Formulir", icon: FileStack },
  { href: "/admin/users", label: "Admin", icon: Users, superAdminOnly: true },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: ScrollText,
    superAdminOnly: true,
  },
];

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();

  const items = navItems.filter(
    (item) => !item.superAdminOnly || admin?.role === "super_admin",
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 shadow-sm backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 items-center justify-between gap-2 px-4 md:px-6 lg:px-8 max-w-7xl">
          <Link
            href="/admin/dashboard"
            className="flex shrink-0 items-center gap-3 transition-transform hover:scale-105"
          >
            <PMKLogo size={36} className="border-2" />
            <span className="flex flex-col leading-tight">
              <span className="font-serif text-base font-bold text-primary">
                PMK Admin
              </span>
              <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
                Portal Formulir &amp; Pelayanan
              </span>
            </span>
          </Link>
          <AdminNav items={items} admin={admin} />
        </div>
      </header>

      <main className="container mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
