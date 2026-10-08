/**
 * PublicShell — header ringan + footer untuk halaman publik (UI Overhaul U1).
 *
 * Dipakai di landing, halaman form, dan success page supaya halaman publik
 * punya "bingkai" konsisten (logo + nama portal di atas, footer di bawah).
 *
 * Server Component (tidak ada interaktivitas) — `children` berisi konten
 * halaman. Background krem `bg-background` sesuai token.
 */
import Link from "next/link";
import { PMKLogo } from "@/components/PMKLogo";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface PublicShellProps {
  children: ReactNode;
  className?: string;
  /**
   * Class tambahan untuk `<header>`. Dipakai halaman form publik untuk
   * menyembunyikan header di desktop (`md:hidden`): di layar lebar halaman form
   * memakai judul + logo besar di dalam kartu (tampilan lama yang disukai),
   * sedangkan di mobile header tipis tetap ada sebagai navigasi.
   */
  headerClassName?: string;
}

export function PublicShell({ children, className, headerClassName }: PublicShellProps) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-background", className)}>
      <header
        className={cn(
          "border-b border-border/60 bg-white/70 backdrop-blur-sm pt-safe",
          headerClassName,
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-center px-4 md:h-20">
          <Link
            href="/"
            // U5 a11y: target sentuh minimal 44px (header h-14=56px, link di
            // dalamnya tadinya hanya ~33px).
            className="flex min-h-[44px] items-center gap-2.5 px-2 transition-transform hover:scale-105"
          >
            <PMKLogo size={44} className="border-2 md:h-16 md:w-16" />
            <span className="flex flex-col leading-tight">
              <span className="font-serif text-sm font-bold text-primary">
                PMK ITERA
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                Portal Formulir &amp; Pelayanan
              </span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center">
        {children}
      </main>

      <footer className="w-full border-t border-border/60 py-8 text-center">
        <p className="px-4 text-xs text-muted-foreground/70">
          Persekutuan Mahasiswa Kristen Institut Teknologi Sumatera &copy;{" "}
          {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
