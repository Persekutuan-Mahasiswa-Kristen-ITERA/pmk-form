import { getOpenForms, countOpenForms } from "@/lib/forms";
import { FormCard } from "@/components/FormCard";
import { GoldenParticles } from "@/components/LazyGoldenParticles";
import { BibleVerseBanner } from "@/components/LazyBibleVerseBanner";
import { ClipboardList, Users, BarChart3, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import {
  FORM_CATEGORIES,
  StatCard,
  FilterChip,
  computeFormStats,
} from "@/components/landing";

export const revalidate = 300; // Cache diperpanjang menjadi 5 menit untuk performa optimal

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedCategory = resolvedParams.category;

  // F2-1: data-access layer tunggal. Query inline Supabase diganti dengan
  // lib/forms.ts; filter "form aktif" memakai definisi tunggal isFormActive().
  const allOpenForms = await getOpenForms();
  const openForms = selectedCategory && selectedCategory !== "all"
    ? allOpenForms.filter((f) => f.form_type === selectedCategory)
    : allOpenForms;

  // Statistik: jumlah form aktif (satu definisi dengan isFormActive).
  const totalForms = await countOpenForms();

  const totalCategories = openForms ? new Set(openForms.map(f => f.form_type)).size : 0;

  // Form yang segera tutup (< 7 hari). Komputasi terkonsentrasi di
  // computeFormStats (memakai isFormActive) — bukan Date.now() tersebar di
  // body komponen (aturan purity React Compiler).
  const upcomingDeadlines = computeFormStats(openForms).closingSoon;

  return (
    <PublicShell>
      <div className="relative w-full overflow-hidden">
        <GoldenParticles />
        <BibleVerseBanner />

        {/* Hero Section — ringkas (prompt U3): batas atas viewport harus
            langsung menampilkan filter + kartu formulir, bukan hanya hero.
            Logo besar di hero sengaja dihapus: PublicShell sudah menampilkan
            logo + nama di header, jadi tidak ada logo ganda. */}
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary sm:mb-3 sm:gap-2 sm:px-4 sm:text-xs">
            <ClipboardList className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Portal Form &amp; Pelayanan
          </div>

          <h1 className="mb-2 px-2 text-center font-serif text-2xl font-bold leading-tight tracking-tight text-foreground sm:mb-3 sm:text-3xl md:text-4xl lg:text-5xl">
            Portal Formulir PMK ITERA
          </h1>
          <p className="mb-5 max-w-xl rounded-full bg-background/40 px-4 py-1.5 text-center text-sm font-medium leading-relaxed text-foreground/70 backdrop-blur-sm sm:mb-6 sm:max-w-2xl sm:px-6 sm:py-2 sm:text-base md:text-lg">
            Satu wadah untuk pendaftaran pelayanan, kegiatan, kepanitiaan, presensi, dan survei PMK ITERA
          </p>

          {/* Quick Stats Bar */}
          <div className="mb-5 grid w-full max-w-3xl grid-cols-3 gap-3 px-2 sm:mb-6 sm:gap-4 sm:px-0">
            <StatCard icon={<Users className="h-5 w-5" />} value={totalForms || 0} label="Total Form" color="primary" />
            <StatCard icon={<BarChart3 className="h-5 w-5" />} value={totalCategories} label="Kategori" color="accent" />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} value={upcomingDeadlines} label="Segera Tutup" color="destructive" />
          </div>

          {/* Filter Bar Kategori Form — scroll horizontal di mobile */}
          <div className="-mx-2 mb-6 flex w-full items-center justify-start gap-1.5 overflow-x-auto px-2 pb-2 sm:mb-8 sm:justify-center sm:gap-2">
            {FORM_CATEGORIES.map((cat) => (
              <FilterChip
                key={cat.value}
                label={cat.label}
                href={cat.value === "all" ? "/" : `/?category=${cat.value}`}
                active={
                  cat.value === "all"
                    ? !selectedCategory || selectedCategory === "all"
                    : selectedCategory === cat.value
                }
              />
            ))}
          </div>

          {/* Grid Form: 1 kolom mobile, 2 tablet, 3 desktop (prompt U3) */}
          {openForms && openForms.length > 0 ? (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
              {openForms.map((form) => (
                <FormCard
                  key={form.id}
                  slug={form.slug}
                  title={form.title}
                  description={form.description ?? ""}
                  closeDate={form.close_date}
                  formType={form.form_type}
                />
              ))}
            </div>
          ) : (
            // Empty state (prompt U3): teks ramah + penjelasan + ajakan.
            <div className="mt-6 flex max-w-sm flex-col items-center justify-center rounded-2xl border border-border/50 bg-white p-6 text-center shadow-lg sm:mt-8 sm:max-w-md sm:rounded-3xl sm:p-10">
              <div className="mx-auto mb-4 h-12 w-12 text-accent opacity-80 sm:mb-6 sm:h-16 sm:w-16">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                  <path d="M12 2v20M5 8h14" />
                </svg>
              </div>
              <h3 className="mb-2 font-serif text-xl font-bold text-foreground sm:mb-3 sm:text-2xl">
                Belum Ada Formulir Aktif
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                Saat ini belum ada formulir yang sedang dibuka
                {selectedCategory && selectedCategory !== "all"
                  ? " untuk kategori ini"
                  : ""}
                . Nantikan informasi dan kegiatan pelayanan berikutnya 🙏
              </p>
              {selectedCategory && selectedCategory !== "all" ? (
                <Link
                  href="/"
                  className="mt-5 inline-flex items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Lihat semua kategori
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
