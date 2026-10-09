import Link from "next/link";
import { Plus, Trash2, Users, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllForms, countResponsesForForms, countActiveForms } from "@/lib/forms";
import { FormQuickActions } from "@/components/FormQuickActions";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, CategoryBadge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Form, FormType } from "@/types/forms";

export const revalidate = 0; // Admin: daftar form real-time, tidak di-cache

/**
 * Halaman daftar formulir admin (UI Overhaul U4).
 *
 * Desktop (md+): kartu grid 2-3 kolom.
 * Mobile (<md): daftar baris ringkas (judul + badge + aksi), bukan kartu
 * (kartu terlalu besar di layar kecil, elemen meluber keluar).
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
        <>
          {/* ===== MOBILE: daftar baris ringkas ===== */}
          <div className="flex flex-col gap-2 md:hidden">
            {formsWithCounts.map((form) => (
              <FormListRow key={form.id} form={form} />
            ))}
          </div>

          {/* ===== DESKTOP: kartu grid ===== */}
          <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
            {formsWithCounts.map((form) => (
              <FormAdminCard key={form.id} form={form} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile: baris ringkas per form                                     */
/* ------------------------------------------------------------------ */
function FormListRow({
  form,
}: {
  form: Form & { responseCount: number };
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
}: {
  form: Form & { responseCount: number };
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
          />
        </div>
      </CardContent>
    </Card>
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
