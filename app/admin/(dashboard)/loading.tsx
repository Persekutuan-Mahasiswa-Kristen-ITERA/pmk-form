import { Skeleton } from "@/components/skeleton";

/**
 * Skeleton dashboard admin (UI Overhaul U1).
 *
 * Menyerupai tata letak dashboard target: header, 4 kartu statistik, area
 * grafik, dan baris-baris daftar formulir terbaru.
 */
export default function AdminDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl md:w-44" />
      </div>

      {/* 4 kartu statistik */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>

      {/* Grafik */}
      <Skeleton className="h-72 rounded-2xl" />

      {/* Daftar formulir terbaru */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="space-y-3 border-b border-border/60 p-5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3 w-60" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-16 rounded-none border-b border-border/40"
          />
        ))}
      </div>
    </div>
  );
}
