import Link from "next/link";
import { PMKLogo } from "@/components/PMKLogo";
import { Button } from "@/components/ui/button";

/**
 * Not-found khusus `/form/[slug]` (UI Overhaul U1).
 *
 * Aman (batasan 6): RLS mengembalikan null untuk form tertutup bagi non-admin,
 * dan `getFormBySlug` mengembalikan null bila form tidak ada — kedua kasus
 * memang TIDAK dibedakan di sini. Pesan digabung: "Formulir tidak ditemukan
 * atau sudah ditutup". Tidak ada bocoran mana yang terjadi.
 */
export default function FormNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <PMKLogo size={112} className="border-4" />

        <div className="space-y-3">
          <h1 className="font-serif text-2xl font-bold text-foreground md:text-3xl">
            Formulir tidak ditemukan atau sudah ditutup
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            Mohon maaf, formulir ini tidak tersedia. Mungkin tautannya keliru,
            atau masa pendaftarannya sudah berakhir. Hubungi panitia bila kamu
            merasa ini adalah kekeliruan.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Lihat formulir lain</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
