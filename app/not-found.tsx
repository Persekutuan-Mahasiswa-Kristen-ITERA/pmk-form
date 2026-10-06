import Link from "next/link";
import type { Metadata } from "next";
import { PMKLogo } from "@/components/PMKLogo";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/auth";

/**
 * Halaman 404 global (UI Overhaul U1).
 *
 * Aman: tidak membocorkan informasi teknis (tidak ada stack trace, tidak ada
 * daftar rute). Tombol sekunder "Lihat formulir" untuk pengguna publik;
 * bila pengguna adalah admin yang sedang login, tombolnya berubah ke
 * "Ke dashboard" — ditentukan di server tanpa membocorkan keberadaan rute
 * admin kepada pengguna tak terautentikasi (yang hanya melihat tombol publik).
 */

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan — PMK ITERA",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  // Admin yang sedang login melihat tombol ke dashboard; pengguna biasa
  // melihat tombol "Lihat formulir". Tidak ada informasi yang bocor: bila
  // bukan admin, hasilnya hanya tombol publik.
  const admin = await getAdminUser().catch(() => null);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <PMKLogo size={112} className="border-4" />

        {/* Angka 404 besar dari token primary, bukan aset eksternal */}
        <div
          aria-hidden="true"
          className="select-none font-serif text-7xl font-bold leading-none text-primary/15 md:text-8xl"
        >
          404
        </div>

        <div className="space-y-3">
          <h1 className="font-serif text-2xl font-bold text-foreground md:text-3xl">
            Halaman tidak ditemukan
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            Maaf, halaman yang kamu cari tidak tersedia atau sudah dipindahkan.
            Coba kembali ke beranda atau jelajahi formulir yang sedang dibuka.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
          {admin ? (
            <Button asChild variant="outline">
              <Link href="/admin/dashboard">Ke dashboard</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/">Lihat formulir</Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
