"use client";

/**
 * AdminNav — navigasi admin desktop + drawer mobile (UI Overhaul U1).
 *
 * SATU client component untuk navigasi karena state aktif per-route butuh
 * `usePathname()`. Desktop: menu inline; mobile (< lg): drawer `Sheet` sisi
 * kiri yang berisi menu, identitas user, dan tombol Keluar (keputusan U0-a).
 *
 * `NAV_ITEMS` (berisi komponen ikon) DIDEFINISIKAN DI SINI, bukan di
 * `AdminShell`. Sebab: `AdminShell` adalah Server Component, dan React
 * melarang melewatkan function/komponen (termasuk ikon lucide) sebagai prop
 * dari Server ke Client Component ("Functions cannot be passed directly to
 * Client Components"). Filter `superAdminOnly` dilakukan di client — aman
 * karena otorisasi sebenarnya tetap ada di setiap route handler.
 *
 * Item menu min-height 44px di mobile (target sentuh).
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Home, FileStack, Users, ScrollText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Hanya tampil untuk super_admin (menu Admin & Audit Log). */
  superAdminOnly?: boolean;
};

export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
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

/** Kelas state aktif: teks accent + latar halus + border krem. */
const ACTIVE_CLASS =
  "aria-[current=page]:border-accent/40 aria-[current=page]:bg-accent/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary";

export function AdminNav({
  admin,
  items = ADMIN_NAV_ITEMS,
}: {
  admin: AdminUser | null;
  items?: readonly NavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const visible = items.filter(
    (item) => !item.superAdminOnly || admin?.role === "super_admin",
  );

  return (
    <>
      {/* Menu desktop */}
      <nav
        className="hidden items-center gap-1 lg:flex"
        aria-label="Navigasi admin"
      >
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-[40px] items-center gap-2 rounded-xl border border-transparent px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary/60 hover:text-primary",
              ACTIVE_CLASS,
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Identitas + Keluar (desktop) */}
      <div className="hidden items-center gap-3 md:flex">
        <div className="flex flex-col items-end leading-tight">
          <span className="max-w-[180px] truncate text-sm font-bold text-foreground">
            {admin?.memberEmail ?? "Admin"}
          </span>
          <span className="text-[10px] font-medium capitalize text-primary">
            {admin?.role ?? "admin"}
          </span>
        </div>
        <SignOutButton />
      </div>

      {/* Navigasi mobile: bar ringkas + drawer */}
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 border-accent/40"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-3/4 flex-col gap-6 p-0 sm:max-w-xs"
          >
            <SheetHeader className="border-b border-border p-5 text-left">
              <SheetTitle className="font-serif text-xl">Menu Admin</SheetTitle>
              <SheetDescription>
                Navigasi formulir &amp; pelayanan PMK ITERA
              </SheetDescription>
            </SheetHeader>

            <div className="flex items-center gap-3 px-5">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-foreground">
                  {admin?.memberEmail ?? "Admin"}
                </span>
                <span className="text-[10px] font-medium capitalize text-primary">
                  {admin?.role ?? "admin"}
                </span>
              </div>
            </div>

            <nav
              className="flex flex-col gap-1 px-3"
              aria-label="Navigasi admin mobile"
            >
              {visible.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary/60 hover:text-primary",
                    ACTIVE_CLASS,
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-border p-5">
              <SignOutButton />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
