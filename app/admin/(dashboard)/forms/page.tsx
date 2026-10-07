import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllForms, countResponsesForForms, countActiveForms } from "@/lib/forms";
import { FormQuickActions } from "@/components/FormQuickActions";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, CategoryBadge } from "@/components/badges";
import { ResponsiveTable } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import type { FormType } from "@/types/forms";

export const revalidate = 60; // Fase 8-4: ISR 60s (dulunya 0 = no cache)

/**
 * Halaman daftar formulir admin (UI Overhaul U4).
 *
 * Prompt: header "Formulir" + "Buat formulir"; toolbar pencarian + FilterChip
 * kategori + filter status; daftar memakai pola baris/kartu yang sama dengan
 * dashboard; empty state; paginasi/"muat lebih banyak" bila banyak.
 *
 * Konsistensi U4: header via `PageHeader`, statistik via `StatCard`, status &
 * kategori via `StatusBadge`/`CategoryBadge` (status selalu ada teksnya —
 * aturan referensi 3.G), daftar via `ResponsiveTable` (tabel di desktop, kartu
 * di mobile).
 */
export default async function FormsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedType = (resolvedParams.type as FormType) || undefined;

  const { data: forms, count: totalForms } = await getAllForms({
    formType: selectedType,
    page: 1,
    pageSize: 50,
  });

  const activeCount = await countActiveForms();

  // Batch-count response counts for all forms in one query (replaces N+1).
  const responseCounts = await countResponsesForForms(forms.map((f) => f.id));
  const formsWithCounts = forms.map((form) => ({
    ...form,
    responseCount: responseCounts[form.id] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formulir"
        subtitle="Kelola seluruh jenis form (presensi, survei, event, recruitment)"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/admin/forms/trash">
                <Trash2 className="mr-2 h-4 w-4" /> Sampah
              </Link>
            </Button>
            <Button asChild className="w-full bg-primary sm:w-auto">
              <Link href="/admin/forms/new">
                <Plus className="mr-2 h-4 w-4" /> Buat formulir
              </Link>
            </Button>
          </div>
        }
      />

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total form" value={totalForms ?? 0} />
        <StatCard
          label="Form aktif"
          value={activeCount}
          description={`dari ${totalForms ?? 0} formulir`}
        />
      </dl>

      {/* Toolbar filter jenis — scroll horizontal di mobile */}
      <div className="flex items-center gap-2 overflow-x-auto border-b pb-3">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          Filter jenis:
        </span>
        {CATEGORY_FILTERS.map((cat) => (
          <FilterChip
            key={cat.value}
            label={cat.label}
            href={cat.value === "all" ? "/admin/forms" : `/admin/forms?type=${cat.value}`}
            active={cat.value === "all" ? !selectedType : selectedType === cat.value}
          />
        ))}
      </div>

      {formsWithCounts.length === 0 ? (
        <EmptyState
          title={
            selectedType
              ? "Tidak ada form untuk kategori ini"
              : "Belum ada form"
          }
          description={
            selectedType
              ? "Coba kategori lain, atau buat formulir baru untuk kategori ini."
              : "Buat formulir pertamamu untuk mulai menerima respons."
          }
          action={
            <Button asChild className="bg-primary">
              <Link href="/admin/forms/new">
                <Plus className="mr-2 h-4 w-4" /> Buat formulir
              </Link>
            </Button>
          }
        />
      ) : (
        <ResponsiveTable
          caption="Daftar formulir"
          columns={[
            { header: "Formulir" },
            { header: "Kategori", className: "w-[110px]" },
            { header: "Status", className: "w-[140px]" },
            { header: "Respons", className: "w-[90px] text-right" },
            { header: "Aksi", className: "w-[170px] text-right" },
          ]}
          rows={formsWithCounts.map((form) => [
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
              className="text-right font-bold tabular-nums text-foreground hover:text-primary hover:underline"
            >
              {form.responseCount}
            </Link>,
            <div key="aksi" className="flex justify-end gap-1.5">
              <FormQuickActions
                formId={form.id}
                isOpen={form.is_open}
                responseCount={form.responseCount}
              />
            </div>,
          ])}
        />
      )}
    </div>
  );
}

const CATEGORY_FILTERS: { label: string; value: FormType | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Recruitment", value: "recruitment" },
  { label: "Event", value: "event" },
  { label: "Survei", value: "survey" },
  { label: "Presensi", value: "presensi" },
  { label: "Umum", value: "general" },
];

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      }`}
    >
      {label}
    </Link>
  );
}
