import { getFormBySlug } from "@/lib/forms";
import { GenericFormRenderer } from "@/components/GenericFormRenderer";
import { GoldenParticles } from "@/components/LazyGoldenParticles";
import { PublicShell } from "@/components/public-shell";
import { notFound } from "next/navigation";
import { isFormActive } from "@/lib/forms";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const revalidate = 60;

export default async function GenericPublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getFormBySlug(slug);

  if (!form) {
    notFound();
  }

  // Batasan prompt 6: 404 tidak membedakan "slug tidak ada" vs "form ditutup"
  // secara berlebihan — RLS mengembalikan null untuk keduanya. Di sini kita
  // hanya menampilkan kartu "Form Ditutup" yang netral.
  // Keep the page gate identical to landing + submit: is_open, open_date and
  // close_date must all be respected (otherwise a scheduled future form was
  // visible and fillable through its direct slug URL).
  const isOpen = isFormActive(form);

  if (!isOpen) {
    return (
      <PublicShell>
        <div className="flex w-full flex-1 items-center justify-center px-4 py-12">
          <GoldenParticles />
          <Card className="z-10 w-full max-w-lg rounded-3xl border-t-8 border-t-accent bg-white p-6 text-center shadow-2xl sm:p-10">
            <CardContent className="space-y-6 pt-6">
              <h1 className="font-serif text-3xl font-bold text-primary sm:text-4xl">
                Form Ditutup
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Mohon maaf, pengisian untuk <br />
                <strong className="text-foreground">{form.title}</strong>
                <br /> telah ditutup.
              </p>
              <div className="pt-6">
                <Button
                  asChild
                  className="w-full rounded-2xl bg-accent py-6 text-lg font-semibold text-accent-foreground hover:bg-accent/90"
                >
                  <Link href="/">Kembali ke Beranda</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell headerClassName="md:hidden">
      <div className="relative w-full overflow-hidden">
        <GoldenParticles />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-primary/10 to-transparent" />
        <GenericFormRenderer form={form} />
      </div>
    </PublicShell>
  );
}
