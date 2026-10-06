"use client";

/**
 * AdminNav — navigasi admin desktop + drawer mobile (UI Overhaul U1).
 *
 * SATU client component untuk navigasi karena state aktif per-route butuh
 * `usePathname()` (hanya tersedia di client). Desktop: menu inline; mobile
 * (< lg): drawer `Sheet` sisi kiri yang berisi menu, identitas user, dan
 * tombol Keluar (keputusan U0-a).
 *
 * Item menu min-height 44px di mobile (target sentuh). Otorisasi TIDAK ada
 * di sini — tetap di layout (`getAdminUser`) + server action.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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

/** Kelas state aktif: teks accent + latar halus + border krem. */
const ACTIVE_CLASS =
  "aria-[current=page]:border-accent/40 aria-[current=page]:bg-accent/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary";

export function AdminNav({
  items,
  admin,
}: {
  items: readonly NavItem[];
  admin: AdminUser | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Menu desktop */}
      <nav
        className="hidden items-center gap-1 lg:flex"
        aria-label="Navigasi admin"
      >
        {items.map((item) => (
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
              {items.map((item) => (
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
