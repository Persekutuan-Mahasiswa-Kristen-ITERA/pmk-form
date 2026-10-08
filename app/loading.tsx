import { Skeleton } from "@/components/skeleton";

/**
 * Skeleton landing page publik (UI Overhaul U1).
 *
 * Bentuk placeholder menyerupai konten nyata: hero, bar statistik, filter
 * chip, dan grid kartu formulir — supaya transisi terasa cepat tanpa
 * pergerakan layout yang besar.
 */
export default function Loading() {
  return (
    <main className="flex w-full flex-col items-center px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="flex w-full max-w-6xl flex-col items-center gap-4">
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-12 w-full max-w-3xl rounded-full" />

        {/* Statistik */}
        <div className="grid w-full max-w-3xl grid-cols-3 gap-3 py-2 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>

        {/* Filter chip */}
        <div className="flex w-full gap-2 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Grid kartu formulir */}
      <div className="mt-6 grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
