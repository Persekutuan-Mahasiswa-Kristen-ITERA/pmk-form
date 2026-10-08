import { Skeleton } from "@/components/skeleton";

/**
 * Skeleton dashboard admin (UI Overhaul U1).
 *
 * RINGAN (U6 feedback): komponen ini hanya menunggu data yang BELUM tiba;
 * begitu `page.tsx` selesai render (beberapa ratus milidetik untuk SSR
 * Supabase), skeleton ini langsung ditukar konten asli via streaming
 * App Router. Dulu skeleton ini mereplikasi banyak elemen UI (4 kartu,
 * grafik, tabel) yang menambah pekerjaan paint React saat halaman sudah
 * siap. Sekarang strukturnya minimal.
 */
export default function AdminDashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6"
      aria-busy="true"
      aria-label="Memuat dashboard"
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>

      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
