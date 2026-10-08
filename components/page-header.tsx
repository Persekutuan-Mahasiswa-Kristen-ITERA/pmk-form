/**
 * PageHeader — judul halaman + subjudul + slot aksi kanan (UI Overhaul U1).
 *
 * Hierarki tipografi mengikuti referensi: judul serif display, subjudul
 * abu-cokelat dibatasi ~60 karakter per baris untuk keterbacaan.
 *
 * Responsif: judul dan aksi bertumpuk di mobile; `actions` dibungkus flex
 * sehingga tombol turun ke bawah, bukan terpotong.
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** Judul halaman (serif display). */
  title: string;
  /** Subjudul abu-cokelat di bawah judul. */
  subtitle?: string;
  /** Slot aksi kanan (tombol utama, dll). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-prose text-sm text-muted-foreground md:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
