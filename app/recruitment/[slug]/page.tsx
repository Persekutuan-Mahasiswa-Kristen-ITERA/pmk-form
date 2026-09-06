import { createClient } from "@/lib/supabase/server";
import { RecruitmentForm } from "@/components/RecruitmentForm";
import { GoldenParticles } from "@/components/GoldenParticles";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const revalidate = 60;

export default async function RecruitmentPage({ params }: { params: Promise<{ slug: string }> }) {
    const supabase = await createClient();

    const { slug } = await params;

    const { data: recruitment } = await supabase
        .from("recruitments")
        .select("id, title, description, is_open, close_date, template_type, form_fields, allowed_angkatan, slug")
        .eq("slug", slug)
        .single();

    if (!recruitment) {
        notFound();
    }

    const isOpen = recruitment.is_open && new Date(recruitment.close_date) > new Date();

    if (!isOpen) {
        return (
            <main className="min-h-screen flex items-center justify-center p-4 relative bg-[#FAF6F0]">
                <GoldenParticles />
                <Card className="max-w-lg w-full border-t-8 border-t-accent shadow-2xl bg-white rounded-3xl p-10 text-center z-10">
                    <CardContent className="space-y-6 pt-6">
                        <h1 className="font-serif text-4xl font-bold text-primary">Pendaftaran Ditutup</h1>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            Mohon maaf, pendaftaran untuk pelayanan <br /><strong className="text-foreground">{recruitment.title}</strong><br /> telah ditutup.
                        </p>
                        <div className="pt-6">
                            <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-2xl py-6 text-lg">
                                <Link href="/">Kembali ke Beranda</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>
        );
    }

    return (
        <main className="min-h-screen pt-12 relative overflow-hidden bg-[#FAF6F0]">
            <GoldenParticles />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none z-0" />
            <RecruitmentForm recruitment={recruitment} />
        </main>
    );
}
