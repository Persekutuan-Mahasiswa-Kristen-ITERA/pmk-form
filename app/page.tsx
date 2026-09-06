import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { GoldenParticles } from "@/components/GoldenParticles";
import { BibleVerseBanner } from "@/components/BibleVerseBanner";
import { RecruitmentCard } from "@/components/RecruitmentCard";

export const revalidate = 60; // Revalidate every minute

export default async function LandingPage() {
  const supabase = await createClient();

  // Fetch only open recruitments
  const { data: recruitments } = await supabase
    .from("recruitments")
    .select("id, slug, title, description, close_date, is_open")
    .eq("is_open", true)
    .order("close_date", { ascending: true });

  // Filter out those past close date just to be safe
  const now = new Date();
  const openRecruitments = recruitments?.filter(r => new Date(r.close_date) > now) || [];

  return (
    <main className="min-h-screen flex flex-col items-center pb-16 relative w-full overflow-x-hidden">
      <GoldenParticles />
      <BibleVerseBanner />

      <div className="w-full max-w-5xl px-4 flex flex-col items-center pt-16 mt-4">
        <div className="relative w-32 h-32 md:w-40 md:h-40 mb-8 rounded-full border-4 border-accent shadow-xl bg-white flex items-center justify-center p-2 z-10 overflow-hidden">
          <Image
            src="https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif"
            alt="PMK ITERA Logo"
            width={150}
            height={150}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-center mb-4 tracking-tight">
          Pusat Pendaftaran Pelayanan
        </h1>
        <p className="text-lg md:text-xl text-foreground/80 text-center max-w-2xl mb-16 font-medium bg-background/50 px-6 py-2 rounded-full backdrop-blur-sm">
          Persekutuan Mahasiswa Kristen Institut Teknologi Sumatera
        </p>

        {openRecruitments.length > 0 ? (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {openRecruitments.map((recruitment) => (
              <RecruitmentCard
                key={recruitment.id}
                slug={recruitment.slug}
                title={recruitment.title}
                description={recruitment.description}
                closeDate={recruitment.close_date}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center text-center max-w-md bg-white p-10 rounded-3xl shadow-lg border border-border/50">
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
            <h3 className="font-serif text-2xl font-bold text-foreground mb-3">Belum Ada Recruitment</h3>
            <p className="text-muted-foreground leading-relaxed">
              Saat ini belum ada pembukaan pelayanan atau kepanitiaan baru.
              <br className="my-2" />
              Nantikan terus kesempatan pelayanan berikutnya 🙏
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
