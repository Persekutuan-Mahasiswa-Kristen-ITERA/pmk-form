import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllForms, countResponsesForForms, countActiveForms } from "@/lib/forms";
import { AdminFormsList } from "@/components/AdminFormsList";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import type { FormType } from "@/types/forms";

export const revalidate = 0; // Admin: daftar form real-time, tidak di-cache

/**
 * Halaman daftar formulir admin (UI Overhaul U4).
 *
 * Desktop (md+): kartu grid 2-3 kolom.
 * Mobile (<md): daftar baris ringkas (judul + badge + aksi), bukan kartu
 * (kartu terlalu besar di layar kecil, elemen meluber keluar).
 *
 * Render list-nya (AdminFormsList) adalah client component supaya aksi cepat
 * toggle/hapus langsung terlihat (optimistic) tanpa router.refresh().
 */
export default async function FormsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedType = (resolvedParams.type as FormType) || undefined;

  const [{ data: forms, count: totalForms }, activeCount] = await Promise.all([
    getAllForms({
      formType: selectedType,
      page: 1,
      pageSize: 50,
    }),
    countActiveForms(),
  ]);

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
        <AdminFormsList forms={formsWithCounts} />
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
      // U5 a11y: target sentuh minimal 44px (kriteria penerimaan §8).
      className={`flex min-h-[44px] shrink-0 items-center rounded-full px-4 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      }`}
    >
      {label}
    </Link>
  );
}
