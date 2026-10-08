import { Skeleton } from "@/components/skeleton";

/**
 * Skeleton halaman formulir publik `/form/[slug]` (UI Overhaul U1).
 *
 * Menyerupai tata letak form: judul, deskripsi, lalu deretan field input
 * (label + kotak input) dan tombol submit di bawah.
 */
export default function FormLoading() {
  return (
    <main className="flex w-full justify-center px-4 pb-24 pt-8 sm:px-6">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header form */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        {/* Field input */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}

        {/* Tombol submit */}
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </main>
  );
}
