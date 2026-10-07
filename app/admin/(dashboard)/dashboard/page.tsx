import { getAllForms, countResponsesForForms } from "@/lib/forms";
import { computeFormStats, FORM_CATEGORIES } from "@/components/landing";
import {
  getResponseChartData,
  getMonthlyResponseStats,
  getTotalResponseCount,
  type ChartData,
} from "@/lib/dashboard";
import { CLOSING_SOON_DAYS } from "@/lib/form-status";
import { daysUntil } from "@/lib/format";
import { isFormActive } from "@/lib/forms";
import Link from "next/link";
import { AlertTriangle, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, CategoryBadge } from "@/components/badges";
import { ResponsiveTable } from "@/components/responsive-table";
import { ResponsesChartCard } from "@/components/responses-chart-card";
import { FormQuickActions } from "@/components/FormQuickActions";
import { Button } from "@/components/ui/button";

export const revalidate = 60; // Fase 8-4: ISR 60s (dulunya 0 = no cache)

export default async function DashboardPage() {
  // F2-1: data-access layer tunggal — getAllForms() sudah requireAdmin().
  const { data: forms } = await getAllForms();

  // F2-4 + F2-5: statistik memakai computeFormStats (sumber: isFormActive),
  // bukan new Date() yang tersebar di body komponen.
  const stats = computeFormStats(forms);

  // Data grafik (U2): agregasi di server, zona WIB. Default 6 bulan.
  const chartData = await getResponseChartData(6).catch((err) => {
    // Gagal memuat grafik tidak boleh membuat dashboard crash — render kartu
    // dengan data kosong (grafik akan menampilkan empty state-nya).
    console.error("Dashboard chart data error:", err instanceof Error ? err.message : "unknown");
    return {
      buckets: [],
      responseCounts: {},
      formOpenedCounts: {},
      total: 0,
    };
  });

  // Kartu "RESPONS MASUK": total + tren bulan berjalan (zona WIB).
  const [totalResponses, monthlyStats] = await Promise.all([
    getTotalResponseCount().catch(() => 0),
    getMonthlyResponseStats().catch(() => ({ count: 0, trend: "flat" as const })),
  ]);

  // Kartu "KATEGORI DIPAKAI": kategori distinct yang dipakai (semua form,
  // keputusan U0-c), diurutkan mengikuti urutan FORM_CATEGORIES.
  const usedTypes = new Set(forms.map((f) => f.form_type));
  const usedCategories = FORM_CATEGORIES.filter(
    (c) => c.value !== "all" && usedTypes.has(c.value),
  );

  // Banner + kartu "SEGERA DITUTUP": form aktif yang close_date <= 7 hari.
  const closingSoonForms = forms
    .filter((f) => {
      if (!isFormActive(f) || !f.close_date) return false;
      const days = daysUntil(f.close_date);
      return days >= 0 && days <= CLOSING_SOON_DAYS;
    })
    .sort((a, b) => daysUntil(a.close_date) - daysUntil(b.close_date));

  // Jumlah respons per form untuk 5 form terbaru (1 query, bukan N+1).
  const recentForms = [...forms]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);
  const responseCounts = await countResponsesForForms(
    recentForms.map((f) => f.id),
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header (prompt 3.C) */}
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan formulir dan pelayanan yang sedang berjalan. Perubahan pada halaman ini tercatat di audit log."
        actions={
          <Button
            asChild
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 md:w-auto"
          >
            <Link href="/admin/forms/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Buat formulir
            </Link>
          </Button>
        }
      />

      {/* Banner peringatan (prompt 3.F) — hanya jika ada form segera ditutup */}
      {closingSoonForms.length > 0 ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
              <AlertTriangle
                className="h-5 w-5 text-destructive"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-lg font-bold text-foreground md:text-xl">
                {closingSoonForms.length} formulir akan segera ditutup
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {/* Nama form dirender sebagai JSX (bukan HTML string) —
                    React meng-escape otomatis, prompt 3.F: tidak render
                    HTML mentah dari DB. */}
                {closingSoonForms.slice(0, 3).map((f, i) => (
                  <span key={f.id}>
                    {i > 0 ? ", " : ""}
                    <Link
                      href={`/admin/forms/${f.id}`}
                      className="font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {f.title}
                    </Link>{" "}
                    {describeDaysLeft(f.close_date)}
                  </span>
                ))}
                {closingSoonForms.length > 3
                  ? `, dan ${closingSoonForms.length - 3} formulir lainnya`
                  : ""}
                . Perpanjang tenggat dari halaman formulir bila masih
                dibutuhkan.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Empat kartu statistik (prompt 3.D) */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Formulir aktif"
          value={stats.activeCount}
          description={`dari ${stats.total} formulir dibuat`}
        />
        <StatCard
          label="Respons masuk"
          value={totalResponses}
          description={
            monthlyStats.trend === "up" && monthlyStats.count > 0
              ? `↑ +${monthlyStats.count} bulan ini`
              : `${monthlyStats.count} respons bulan ini`
          }
        />
        <StatCard
          label="Segera ditutup"
          value={closingSoonForms.length}
          description={`tenggat dalam ${CLOSING_SOON_DAYS} hari`}
          variant={closingSoonForms.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Kategori dipakai"
          value={usedCategories.length}
          description={usedCategories.map((c) => c.label).join(", ") || "—"}
        />
      </dl>

      {/* Grafik "Respons per periode" (prompt 3.E) */}
      <SectionCard
        title="Respons per periode"
        subtitle={`Menampilkan 6 bulan terakhir · total ${chartData.total} respons`}
      >
        <ResponsesChartCard
          initialData={chartData}
          initialMonths={6}
        />
      </SectionCard>

      {/* Tabel "Formulir terbaru" (prompt 3.G) */}
      <SectionCard
        title="Formulir terbaru"
        subtitle="Aksi cepat langsung berlaku pada baris terkait."
        actions={
          <Link
            href="/admin/forms"
            className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            Lihat semua formulir
          </Link>
        }
      >
        {recentForms.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada formulir. Buat formulir pertamamu.
          </p>
        ) : (
          <ResponsiveTable
            caption="Formulir terbaru"
            columns={[
              { header: "Formulir" },
              { header: "Kategori", className: "w-[110px]" },
              { header: "Status", className: "w-[140px]" },
              { header: "Respons", className: "w-[90px] text-right" },
              { header: "Aksi", className: "w-[150px] text-right" },
            ]}
            rows={recentForms.map((form) => [
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
                {responseCounts[form.id] ?? 0}
              </Link>,
              <div key="aksi" className="flex justify-end">
                <FormRowActions
                  formId={form.id}
                  isOpen={form.is_open}
                  responseCount={responseCounts[form.id] ?? 0}
                />
              </div>,
            ])}
          />
        )}
      </SectionCard>
    </div>
  );
}

/** Deskripsi sisa waktu: "ditutup 2 hari lagi" / "ditutup besok" / "ditutup hari ini". */
function describeDaysLeft(closeDate: string): string {
  const days = daysUntil(closeDate);
  if (days <= 0) return "ditutup hari ini";
  if (days === 1) return "ditutup besok";
  return `ditutup ${days} hari lagi`;
}

/**
 * Aksi baris tabel (prompt 3.G): Tutup/Buka, Duplikasi, Hapus.
 *
 * `FormQuickActions` (Fase 4C) dipakai apa adanya — ia sudah memakai server
 * action yang ada (`toggleFormOpenAction`, `duplicateFormAction`,
 * `deleteFormAction`) dengan toast + konfirmasi. Tombol Hapus memakai
 * konfirmasi 2-klik bawaan komponen itu; aturan "form berisi respons tidak
 * boleh di-hard-delete" ditegakkan di server (`deleteForm` melakukan soft
 * delete) — UI menampilkan tooltip yang menjelaskannya.
 */
function FormRowActions({
  formId,
  isOpen,
  responseCount,
}: {
  formId: string;
  isOpen: boolean;
  responseCount: number;
}) {
  return (
    <FormQuickActions
      formId={formId}
      isOpen={isOpen}
      responseCount={responseCount}
    />
  );
}
