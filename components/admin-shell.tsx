import Link from "next/link";
import { PMKLogo } from "@/components/PMKLogo";
import { getAdminUser } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";

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
 * Server Component — hanya menjalankan `getAdminUser()` untuk meneruskan
 * identitas ke `AdminNav` (client). Daftar menu (`ADMIN_NAV_ITEMS`, berisi
 * komponen ikon) DIDEFINISIKAN DI `AdminNav` karena React melarang function
 * dilewatkan dari Server ke Client Component.
 *
 * Otorisasi TIDAK ADA di sini — tetap di layout (`getAdminUser`) + server
 * action; shell ini hanya presentasi.
 */
export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();

  return (
    <div className="flex min-h-dvh flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 pt-safe shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 md:h-20 md:px-6 lg:px-8">
          <Link
            href="/admin/dashboard"
            className="flex shrink-0 items-center gap-3 transition-transform hover:scale-105"
          >
            <PMKLogo size={44} className="border-2" />
            <span className="flex flex-col leading-tight">
              <span className="font-serif text-base font-bold text-primary">
                PMK Admin
              </span>
              <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
                Portal Formulir &amp; Pelayanan
              </span>
            </span>
          </Link>
          <AdminNav admin={admin} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
