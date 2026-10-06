"use client";

/**
 * Error boundary root (UI Overhaul U1).
 *
 * Aman (batasan 6): pesan generik tanpa stack trace atau detail error mentah.
 * Tidak ada PII yang di-log ke console browser (hanya digest error anonim,
 * yang dipakai Vercel untuk pelacakan error di sisi server).
 *
 * Client component wajib untuk error boundary (aturan Next.js).
 */
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log hanya digest anonim (id pelacakan), BUKAN pesan error yang bisa
    // mengandung data sensitif.
    console.error("Unhandled error digest:", error.digest);
  }, [error.digest]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-destructive/30 bg-destructive/5">
          <RotateCcw className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>

        <div className="space-y-3">
          <h1 className="font-serif text-2xl font-bold text-foreground md:text-3xl">
            Terjadi kesalahan
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            Maaf, sesuatu tidak berjalan semestanya. Coba muat ulang halaman
            ini. Bila masalah tetap berlanjut, kembali ke beranda dan coba
            beberapa saat lagi.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button onClick={() => reset()}>Coba lagi</Button>
          <Button asChild variant="outline">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
