/**
 * StatCard — kartu statistik pola dashboard (UI Overhaul U1).
 *
 * Pola referensi: label kapital kecil, angka besar serif, keterangan kecil
 * di bawah. Varian `warning` memakai latar/border merah muda yang diturunkan
 * dari token `destructive` (tidak ada warna baru) untuk kartu "Segera
 * ditutup"; bila nilainya 0, pemanggil sebaiknya memakai varian `default`
 * supaya kartu tampil netral (aturan referensi 3.D).
 *
 * Komponen `StatCard` di `components/landing.tsx` (Fase 1) tetap dipakai untuk
 * landing; komponen ini adalah versi pola dashboard dengan label + keterangan.
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface StatCardProps {
  /** Label kapital kecil di atas angka, mis. "FORMULIR AKTIF". */
  label: string;
  /** Angka statistik besar (serif). */
  value: ReactNode;
  /** Keterangan kecil di bawah angka. */
  description?: ReactNode;
  /** Varian tampilan. `warning` = merah muda dari token `destructive`. */
  variant?: "default" | "warning";
  className?: string;
}

export function StatCard({
  label,
  value,
  description,
  variant = "default",
  className,
}: StatCardProps) {
  const isWarning = variant === "warning";
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        isWarning
          ? "border-destructive/40 bg-destructive/5"
          : "border-border",
        className,
      )}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "font-serif text-3xl font-bold leading-none md:text-4xl",
          isWarning ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </dd>
      {description ? (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            // Batasi 2 baris dengan elipsis di layar kecil (referensi 3.D).
            "line-clamp-2",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
