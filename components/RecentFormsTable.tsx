"use client";

import Link from "next/link";
import { ResponsiveTable } from "@/components/responsive-table";
import { CategoryBadge, StatusBadge } from "@/components/badges";
import { FormQuickActions } from "@/components/FormQuickActions";
import { useOptimisticForms, type FormWithCount } from "@/hooks/use-optimistic-forms";

/**
 * Tabel "Formulir terbaru" di dashboard (5 form terbaru).
 *
 * CLIENT COMPONENT — state daftar dipegang lokal supaya toggle/hapus terlihat
 * seketika (optimistic) tanpa router.refresh(). Sebelumnya setiap aksi cepat
 * memicu refresh seluruh halaman (semua query dashboard + layout).
 */
export function RecentFormsTable({ forms }: { forms: FormWithCount[] }) {
  const { forms: optimisticForms, setOpen, remove } = useOptimisticForms(forms);

  if (optimisticForms.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Belum ada formulir. Buat formulir pertamamu.
      </p>
    );
  }

  return (
    <ResponsiveTable
      caption="Formulir terbaru"
      columns={[
        { header: "Formulir" },
        { header: "Kategori", className: "w-[110px]" },
        { header: "Status", className: "w-[140px]" },
        { header: "Respons", className: "w-[90px] text-right" },
        { header: "Aksi", className: "w-[150px] text-right" },
      ]}
      rows={optimisticForms.map((form) => [
        <Link
          key={form.id}
          href={`/admin/forms/${form.id}`}
          className="font-semibold text-foreground hover:text-primary hover:underline"
        >
          {form.title}
        </Link>,
        <CategoryBadge key="cat" value={form.form_type} />,
        <StatusBadge key="status" form={form} />,
        <Link
          key="resp"
          href={`/admin/forms/${form.id}/responses`}
          className="font-bold tabular-nums text-foreground hover:text-primary hover:underline"
        >
          {form.responseCount}
        </Link>,
        <div key="aksi" className="flex justify-end">
          <FormQuickActions
            formId={form.id}
            isOpen={form.is_open}
            responseCount={form.responseCount}
            onToggled={setOpen}
            onDeleted={remove}
          />
        </div>,
      ])}
    />
  );
}
