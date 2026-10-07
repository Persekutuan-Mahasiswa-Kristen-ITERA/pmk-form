import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllForms, countFormResponses } from "@/lib/forms";
import { TrashFormsClient } from "@/components/TrashFormsClient";
import { PageHeader } from "@/components/page-header";
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
    <div className="space-y-6">
      <PageHeader
        title="Sampah"
        subtitle="Form yang dihapus tetapi masih memiliki respons. Data aman; bisa dikembalikan kapan saja."
        actions={
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/admin/forms">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke formulir
            </Link>
          </Button>
        }
      />

      <TrashFormsClient forms={deletedForms} counts={countsMap} />
    </div>
  );
}
