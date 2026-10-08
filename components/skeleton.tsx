/**
 * Skeleton — blok placeholder berdenyut untuk loading state (UI Overhaul U1).
 *
 * `loading.tsx` memakai komponen ini supaya transisi antar halaman terasa
 * cepat dan tidak "lompat" (layout shift) — bentuk placeholder menyerupai
 * konten yang akan datang.
 */
import { cn } from "@/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-secondary", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Skeleton kartu statistik (label kecil + angka besar). */
export function StatCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

/** Skeleton baris daftar formulir (judul + meta + badge). */
export function FormRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border/60 p-4">
      <Skeleton className="h-10 w-1.5 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
  );
}
