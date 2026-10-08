/**
 * EmptyState — state kosong konsisten untuk semua daftar (UI Overhaul U1).
 *
 * Digunakan saat hasil query kosong (bukan saat error). Selalu menyertakan
 * ikon/visual, judul serif, deskripsi, dan opsional aksi (tautan/tombol).
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Ikon/visual di atas judul. */
  icon?: ReactNode;
  title: string;
  /** Deskripsi atau penjelasan ramah. */
  description?: string;
  /** Slot aksi di bawah deskripsi (tombol/tautan). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-14 w-14 items-center justify-center text-accent">
          {icon}
        </div>
      ) : null}
      <div className="space-y-2">
        <h3 className="font-serif text-xl font-bold text-foreground">
          {title}
        </h3>
      </div>
      {description ? (
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
