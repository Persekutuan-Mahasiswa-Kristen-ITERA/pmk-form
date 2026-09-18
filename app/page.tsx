import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoldenParticles } from "@/components/GoldenParticles";
import { BibleVerseBanner } from "@/components/BibleVerseBanner";
import { FormCard } from "@/components/FormCard";
import { ClipboardList, Users, BarChart3, TrendingUp } from "lucide-react";

export const revalidate = 300; // Cache diperpanjang menjadi 5 menit untuk performa optimal

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedCategory = resolvedParams.category;

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Optimasi Database Query: Filter langsung di Supabase alih-alih di JS
  let query = supabase
    .from("forms")
    .select("id, slug, title, description, close_date, is_open, form_type")
    .eq("is_open", true)
    .gt("close_date", now)
    .order("close_date", { ascending: true });

  if (selectedCategory && selectedCategory !== "all") {
    query = query.eq("form_type", selectedCategory);
  }

  const { data: openForms } = await query;

  // Ambil total form aktif untuk statistik (query ringan)
  const { count: totalForms } = await supabase
    .from("forms")
    .select("*", { count: "exact", head: true })
    .eq("is_open", true)
    .gt("close_date", now);

  const totalCategories = openForms ? new Set(openForms.map(f => f.form_type)).size : 0;
  
  // Hitung yang segera tutup (< 7 hari)
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const upcomingDeadlines = openForms?.filter(f => f.close_date <= sevenDaysLater).length || 0;

  return (
    <main className="min-h-screen flex flex-col items-center pb-20 relative w-full overflow-x-hidden bg-[#FAF6F0]">
      <GoldenParticles />
      <BibleVerseBanner />

      {/* Hero Section */}
      <div className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col items-center pt-10 sm:pt-16 mt-2">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 mb-5 sm:mb-6 rounded-full border-3 sm:border-4 border-accent shadow-xl bg-white flex items-center justify-center p-1.5 sm:p-2 z-10 overflow-hidden">
          <Image
            src="https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif"
            alt="PMK ITERA Logo"
            width={120}
            height={120}
            className="object-contain"
            priority
            sizes="(max-width: 640px) 120px, (max-width: 768px) 140px, 160px"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-accent/15 border border-accent/30 text-primary text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-3 sm:mb-4">
          <ClipboardList className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Portal Form & Pelayanan
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground text-center mb-3 sm:mb-4 tracking-tight leading-tight px-2">
          Portal Formulir PMK ITERA
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-foreground/70 text-center max-w-xl sm:max-w-2xl mb-6 sm:mb-8 font-medium bg-background/40 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full backdrop-blur-sm leading-relaxed px-2">
          Satu wadah untuk pendaftaran pelayanan, kegiatan, kepanitiaan, presensi, dan survei PMK ITERA
        </p>

        {/* Quick Stats Bar */}
        <div className="w-full max-w-3xl grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 px-2 sm:px-0">
          <StatCard icon={<Users className="w-5 h-5" />} value={totalForms || 0} label="Total Form" color="primary" />
          <StatCard icon={<BarChart3 className="w-5 h-5" />} value={totalCategories} label="Kategori" color="accent" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} value={upcomingDeadlines} label="Segera Tutup" color="destructive" />
        </div>

        {/* Filter Bar Kategori Form */}
        <div className="w-full flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 px-2 -mx-2 scrollbar-hide">
          <FilterChip label="Semua" href="/" active={!selectedCategory || selectedCategory === "all"} />
          <FilterChip label="Recruitment" href="/?category=recruitment" active={selectedCategory === "recruitment"} />
          <FilterChip label="Event" href="/?category=event" active={selectedCategory === "event"} />
          <FilterChip label="Survei" href="/?category=survey" active={selectedCategory === "survey"} />
          <FilterChip label="Presensi" href="/?category=presensi" active={selectedCategory === "presensi"} />
          <FilterChip label="Umum" href="/?category=general" active={selectedCategory === "general"} />
        </div>

        {/* Grid Form */}
        {openForms && openForms.length > 0 ? (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
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
          <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center text-center max-w-sm sm:max-w-md bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl shadow-lg border border-border/50">
            <div className="w-12 h-12 sm:w-16 sm:h-16 text-accent mb-4 sm:mb-6 opacity-80 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <path d="M12 2v20M5 8h14" />
              </svg>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-foreground mb-2 sm:mb-3">Belum Ada Formulir Aktif</h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Saat ini belum ada formulir yang sedang dibuka untuk kategori ini.
              <br className="hidden sm:block my-2" />
              Nantikan informasi dan kegiatan pelayanan berikutnya 🙏
            </p>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <footer className="w-full max-w-6xl px-4 py-8 text-center">
        <p className="text-xs text-muted-foreground/60">
          Persekutuan Mahasiswa Kristen Institut Teknologi Sumatera &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    accent: "bg-amber-100 text-amber-700 border-amber-200",
    destructive: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className={`rounded-2xl p-3 sm:p-4 text-center bg-white shadow-sm border ${colorMap[color] || colorMap.primary} transition-all hover:shadow-md`}>
      <div className="flex items-center justify-center gap-2 mb-1.5">
        {icon}
      </div>
      <div className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{value}</div>
      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all shrink-0 border shadow-sm whitespace-nowrap ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
          : "bg-white text-foreground/70 border-border/50 hover:bg-secondary/50 hover:border-accent/30"
      }`}
    >
      {label}
    </Link>
  );
}