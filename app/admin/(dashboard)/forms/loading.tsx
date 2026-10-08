import { Skeleton } from "@/components/skeleton";

/**
 * Skeleton daftar formulir admin (U6 feedback).
 *
 * RINGAN: hanya struktur umum halaman (header + 2 stat + daftar).
 * Daftar tidak di-skeleton per-baris — karena React akan menukar seluruh
 * subtree dengan data nyata begitu server selesai, dan membuat banyak
 * placeholder baris justru menambah pekerjaan paint. SSR halaman ini
 * umumnya selesai < 500 ms (parallelized queries di page.tsx).
 */
export default function AdminFormsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6"
      aria-busy="true"
      aria-label="Memuat daftar formulir"
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  );
}
