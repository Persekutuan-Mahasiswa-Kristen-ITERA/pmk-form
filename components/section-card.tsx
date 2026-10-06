/**
 * SectionCard — kartu putih + judul serif + subjudul + aksi kanan-atas
 * (UI Overhaul U1).
 *
 * Pola yang berulang di dashboard & halaman admin: kartu putih di atas latar
 * krem, judul serif, subjudul kecil, dan aksi (tautan "Lihat semua", dll) di
 * kanan atas.
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface SectionCardProps {
  /** Judul kartu (serif display). */
  title: string;
  /** Subjudul kecil di bawah judul. */
  subtitle?: string;
  /** Slot aksi kanan-atas (tautan, tombol). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Kelas tambahan untuk area konten. */
  contentClassName?: string;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-border bg-white p-0 shadow-sm",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/60 bg-background/40 p-5 md:p-6">
        <div className="space-y-1">
          <h2 className="font-serif text-xl font-bold text-foreground md:text-2xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground md:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn("p-5 md:p-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
