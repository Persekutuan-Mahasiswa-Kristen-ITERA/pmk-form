import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllForms, countFormResponses } from "@/lib/forms";
import { TrashFormsClient } from "@/components/TrashFormsClient";
import type { Form } from "@/types/forms";

/**
 * Halaman sampah (Fase 7-6): form yang di-soft-delete.
 *
 * Server Component, admin only (getAllForms memanggil requireAdmin()).
 * Form di sini is_deleted = true — disembunyikan dari dashboard & landing,
 * data + respons tetap utuh. Bisa dikembalikan (restore).
 */
export const revalidate = 0;

export default async function TrashPage() {
  const { data: forms } = await getAllForms({
    includeDeleted: true,
    page: 1,
    pageSize: 100,
  });

  // Pastikan hanya form terhapus yang ditampilkan (double-check defensif;
  // getAllForms(includeDeleted) sudah memfilter is_deleted = true).
  const deletedForms: Form[] = (forms ?? []).filter((f) => f.is_deleted);

  // Hitung respons per form untuk info di kartu.
  const counts = await Promise.all(
    deletedForms.map(async (f) => [f.id, await countFormResponses(f.id)] as const)
  );
  const countsMap: Record<string, number> = Object.fromEntries(counts);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="flex items-center gap-3 border-b pb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/forms">
            <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
          </Link>
        </Button>
        <div>
          <h1 className="font-serif text-2xl font-bold">Sampah</h1>
          <p className="text-xs text-muted-foreground">
            Form yang dihapus tetapi masih memiliki respons. Data aman; bisa
            dikembalikan kapan saja.
          </p>
        </div>
      </div>

      <TrashFormsClient forms={deletedForms} counts={countsMap} />
    </div>
  );
}
