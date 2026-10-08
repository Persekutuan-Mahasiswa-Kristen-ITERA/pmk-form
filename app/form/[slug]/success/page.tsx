import { getFormBySlug } from "@/lib/forms";
import { PublicShell } from "@/components/public-shell";
import { GoldenParticles } from "@/components/LazyGoldenParticles";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Respons terkirim — PMK ITERA",
  robots: { index: false, follow: false },
};

/**
 * Halaman sukses `/form/[slug]/success` (UI Overhaul U3).
 *
 * Prompt: "konfirmasi jelas, thank_you_message, tombol link grup WhatsApp yang
 * menonjol bila ada, tombol kembali ke beranda. Pastikan redirect_url tetap
 * dihormati."
 *
 * Perubahan dari versi lama (client component):
 * - settings sekarang diambil di SERVER lewat `getFormBySlug` (RLS berlaku),
 *   bukan query client anon ke tabel `forms` — tidak ada select publik lagi.
 * - QR code dihapus: prompt hanya meminta tombol yang menonjol, dan ini
 *   menghilangkan dependency client berat (react-qr-code) dari halaman.
 * - Gerbang "Selesai" yang memaksa centang "sudah gabung grup" dihapus: tombol
 *   kembali ke beranda selalu aktif (pendaftar tidak boleh terjebak).
 *
 * `redirect_url` (bila diatur) tetap dihormati: submit di renderer mengarahkan
 * langsung ke sana, dan halaman ini tidak menimpa perilaku itu.
 */
export default async function GenericSuccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getFormBySlug(slug);

  // Form tidak ditemukan → 404 (aman, tidak membocorkan alasan).
  if (!form) {
    notFound();
  }

  const settings = form.settings ?? {};
  const thankYouMessage =
    typeof settings.thank_you_message === "string" && settings.thank_you_message.trim()
      ? settings.thank_you_message.trim()
      : "Respons kamu telah berhasil kami terima.";
  const waGroupLink =
    typeof settings.wa_group_link === "string" && settings.wa_group_link.trim()
      ? settings.wa_group_link.trim()
      : null;

  return (
    <PublicShell>
      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <GoldenParticles />

        <div className="z-10 flex w-full max-w-lg flex-col items-center rounded-[2.5rem] border border-accent/30 bg-white/85 p-8 text-center shadow-2xl backdrop-blur-md sm:p-12">
          {/* Konfirmasi jelas: ikon centang besar + judul serif */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/10 shadow-inner">
            <CheckCircle2
              className="h-10 w-10 text-accent"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </div>

          <h1 className="mb-4 font-serif text-3xl font-bold text-primary md:text-4xl">
            Terima Kasih!
          </h1>
          <p className="mb-8 whitespace-pre-wrap font-serif text-lg leading-relaxed text-foreground/80">
            {thankYouMessage}
          </p>

          {/* Tombol grup WhatsApp menonjol bila ada (prompt U3) */}
          {waGroupLink ? (
            <div className="mb-8 w-full space-y-4 rounded-3xl border-2 border-accent/40 bg-accent/5 p-6 shadow-inner">
              <div>
                <h2 className="mb-1 font-serif text-xl font-bold text-primary">
                  Grup WhatsApp
                </h2>
                <p className="text-sm text-muted-foreground">
                  Klik tombol di bawah untuk bergabung ke grup pemberitahuan.
                </p>
              </div>

              <Button
                asChild
                className="w-full rounded-2xl bg-[#25D366] py-6 text-base font-bold text-white shadow-md transition-transform hover:scale-[1.01] hover:bg-[#128C7E]"
              >
                <a href={waGroupLink} target="_blank" rel="noopener noreferrer">
                  Gabung Grup WhatsApp
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Terbuka di aplikasi WhatsApp kamu.
              </p>
            </div>
          ) : null}

          <Button
            asChild
            className="w-full rounded-2xl bg-accent px-8 py-6 text-lg font-bold text-accent-foreground shadow-lg transition-transform hover:scale-[1.01] hover:bg-accent/90"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-5 w-5" /> Kembali ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}
