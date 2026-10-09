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

/**
 * Skeleton tabel respons (header + 5 baris).
 * Dipakai saat GenericResponseTable di-load on-demand (code-splitting
 * JSZip/Papa.parse) supaya tidak ada layout shift yang kasar.
 */
export function ResponsesTableSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="border-b pb-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border/60 p-4 space-y-2">
          <Skeleton className="h-5 w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/60 p-4"
          >
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1 max-w-[180px]" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton form builder (canvas + palet field).
 * Dipakai saat GenericFormBuilder di-load on-demand (code-splitting
 * @dnd-kit + react-hook-form).
 */
export function FormBuilderSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/60 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
