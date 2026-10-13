"use client";

import Link from "next/link";
import { Users, Calendar, Eye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, CategoryBadge } from "@/components/badges";
import { FormQuickActions } from "@/components/FormQuickActions";
import { useOptimisticForms, type FormWithCount } from "@/hooks/use-optimistic-forms";

/**
 * Daftar formulir admin (mobile: baris ringkas; desktop: kartu grid).
 *
 * CLIENT COMPONENT — memegang state daftar supaya aksi cepat (toggle/hapus)
 * langsung terlihat tanpa router.refresh(). Server action tetap menjadi
 * sumber kebenaran: UI hanya mencerminkan perubahan yang dikonfirmasi server
 * (rollback otomatis bila gagal).
 *
 * Sebelumnya: setiap toggle/hapus memicu router.refresh() yang me-render ulang
 * seluruh halaman (semua query Supabase + layout) — terasa lambat.
 */
export function AdminFormsList({ forms }: { forms: FormWithCount[] }) {
  const { forms: optimisticForms, setOpen, remove } = useOptimisticForms(forms);

  if (optimisticForms.length === 0) {
    return null;
  }

  return (
    <>
      {/* ===== MOBILE: daftar baris ringkas ===== */}
      <div className="flex flex-col gap-2 md:hidden">
        {optimisticForms.map((form) => (
          <FormListRow
            key={form.id}
            form={form}
            onToggled={setOpen}
            onDeleted={remove}
          />
        ))}
      </div>

      {/* ===== DESKTOP: kartu grid ===== */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
        {optimisticForms.map((form) => (
          <FormAdminCard
            key={form.id}
            form={form}
            onToggled={setOpen}
            onDeleted={remove}
          />
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile: baris ringkas per form                                     */
/* ------------------------------------------------------------------ */
function FormListRow({
  form,
  onToggled,
  onDeleted,
}: {
  form: FormWithCount;
  onToggled: (id: string, isOpen: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-sm">
      {/* Kiri: info utama */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge value={form.form_type} />
          <StatusBadge form={form} />
        </div>
        <h2 className="truncate text-sm font-semibold text-foreground">
          <Link
            href={`/admin/forms/${form.id}`}
            className="hover:text-primary hover:underline"
          >
            {form.title}
          </Link>
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {form.responseCount}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(form.close_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
      </div>

      {/* Kanan: aksi ringkas */}
      <div className="flex shrink-0 items-center gap-0.5">
        <FormQuickActions
          formId={form.id}
          isOpen={form.is_open}
          responseCount={form.responseCount}
          onToggled={onToggled}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop: kartu grid                                                */
/* ------------------------------------------------------------------ */
function FormAdminCard({
  form,
  onToggled,
  onDeleted,
}: {
  form: FormWithCount;
  onToggled: (id: string, isOpen: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Card className="flex h-full flex-col justify-between overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex flex-wrap items-start gap-2">
          <CategoryBadge value={form.form_type} />
          <StatusBadge form={form} />
        </div>
        <h2 className="line-clamp-1 text-base font-bold leading-tight text-foreground">
          <Link
            href={`/admin/forms/${form.id}`}
            className="hover:text-primary hover:underline"
          >
            {form.title}
          </Link>
        </h2>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {form.description || "Tidak ada deskripsi."}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {form.responseCount} Respons
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Tutup:{" "}
            {new Date(form.close_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/form/${form.slug}`}
              target="_blank"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-3.5 w-3.5" /> Pratinjau
            </Link>
            <Link
              href={`/admin/forms/${form.id}/responses`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Users className="h-3.5 w-3.5" /> Respons ({form.responseCount})
            </Link>
          </div>

          <FormQuickActions
            formId={form.id}
            isOpen={form.is_open}
            responseCount={form.responseCount}
            onToggled={onToggled}
            onDeleted={onDeleted}
          />
        </div>
      </CardContent>
    </Card>
  );
}
