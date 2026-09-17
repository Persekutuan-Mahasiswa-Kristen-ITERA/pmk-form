import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoldenParticles } from "@/components/GoldenParticles";
import { BibleVerseBanner } from "@/components/BibleVerseBanner";
import { FormCard } from "@/components/FormCard";
import { Search, Filter, ClipboardList, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const revalidate = 60; // ISR 60 detik

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedCategory = resolvedParams.category;

  const supabase = await createClient();

  // Ambil form aktif dari tabel forms
  let query = supabase
    .from("forms")
    .select("id, slug, title, description, close_date, is_open, form_type")
    .eq("is_open", true)
    .order("close_date", { ascending: true });

  if (selectedCategory && selectedCategory !== "all") {
    query = query.eq("form_type", selectedCategory);
  }

  const { data: rawForms } = await query;

  // Filter form yang belum kedaluwarsa
  const now = new Date();
  const openForms = rawForms?.filter((f) => new Date(f.close_date) > now) || [];

  return (
    <main className="min-h-screen flex flex-col items-center pb-20 relative w-full overflow-x-hidden bg-[#FAF6F0]">
      <GoldenParticles />
      <BibleVerseBanner />

      {/* Hero Section */}
      <div className="w-full max-w-5xl px-4 flex flex-col items-center pt-12 mt-2">
        <div className="relative w-28 h-28 md:w-36 md:h-36 mb-6 rounded-full border-4 border-accent shadow-xl bg-white flex items-center justify-center p-2 z-10 overflow-hidden">
          <Image
            src="https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif"
            alt="PMK ITERA Logo"
            width={140}
            height={140}
            className="object-contain"
            priority
          />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/20 border border-accent/40 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
          <ClipboardList className="w-3.5 h-3.5" /> Portal Form & Pelayanan
        </div>

        <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl font-bold text-foreground text-center mb-4 tracking-tight">
          Portal Formulir PMK ITERA
        </h1>
        <p className="text-base md:text-lg text-foreground/80 text-center max-w-2xl mb-8 font-medium bg-background/50 px-6 py-2 rounded-full backdrop-blur-sm">
          Satu wadah untuk pendaftaran pelayanan, kegiatan, kepanitiaan, presensi, dan survei PMK ITERA
        </p>

        {/* Action Bar (Cek Hasil) */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          <Button asChild variant="outline" size="sm" className="rounded-xl border-accent/50 bg-white hover:bg-highlight/30">
            <Link href="/hasil">
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-primary" /> Cek Hasil Seleksi Oprec
            </Link>
          </Button>
        </div>

        {/* Filter Bar Kategori Form */}
        <div className="w-full flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2">
          <FilterChip label="Semua Form" href="/" active={!selectedCategory || selectedCategory === "all"} />
          <FilterChip label="Recruitment" href="/?category=recruitment" active={selectedCategory === "recruitment"} />
          <FilterChip label="Pendaftaran Event" href="/?category=event" active={selectedCategory === "event"} />
          <FilterChip label="Survei" href="/?category=survey" active={selectedCategory === "survey"} />
          <FilterChip label="Presensi" href="/?category=presensi" active={selectedCategory === "presensi"} />
          <FilterChip label="Umum" href="/?category=general" active={selectedCategory === "general"} />
        </div>

        {/* Grid Form */}
        {openForms.length > 0 ? (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {openForms.map((form) => (
              <FormCard
                key={form.id}
                slug={form.slug}
                title={form.title}
                description={form.description}
                closeDate={form.close_date}
                formType={form.form_type}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center text-center max-w-md bg-white p-10 rounded-3xl shadow-lg border border-border/50">
            <svg
              className="w-16 h-16 text-accent mb-6 opacity-80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M5 8h14" />
            </svg>
            <h3 className="font-serif text-2xl font-bold text-foreground mb-3">Belum Ada Formulir Aktif</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Saat ini belum ada formulir yang sedang dibuka untuk kategori ini.
              <br className="my-2" />
              Nantikan informasi dan kegiatan pelayanan berikutnya 🙏
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 border shadow-sm ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
          : "bg-white text-foreground/80 border-border/60 hover:bg-secondary"
      }`}
    >
      {label}
    </Link>
  );
}
