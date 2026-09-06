import { createClient } from "@/lib/supabase/server";
import { ApplicantTable } from "@/components/ApplicantTable";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const revalidate = 0;

export default async function ApplicantsPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const supabase = await createClient();
    const { id } = await params;
    const sp = await searchParams;

    const page = typeof sp.page === 'string' ? parseInt(sp.page, 10) : 1;
    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: recruitment } = await supabase
        .from("recruitments")
        .select("title")
        .eq("id", id)
        .single();

    if (!recruitment) notFound();

    // Fetch total count for pagination
    const { count } = await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("recruitment_id", id);

    const totalPages = count ? Math.ceil(count / limit) : 1;

    const { data: submissions } = await supabase
        .from("submissions")
        .select("id, applicant_name, applicant_email, applicant_nim, submitted_at, answers, files")
        .eq("recruitment_id", id)
        .order("submitted_at", { ascending: false })
        .range(from, to);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-2">
                <Button variant="ghost" asChild className="hover:bg-primary/10 text-primary -ml-4 rounded-xl">
                    <Link href="/admin/recruitments">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar
                    </Link>
                </Button>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-border/50">
                <h1 className="font-serif text-3xl font-bold text-foreground">Data Pendaftar</h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    Untuk Pelayanan: <strong className="text-primary font-serif italic text-xl">{recruitment.title}</strong>
                </p>
            </div>

            <ApplicantTable
                submissions={submissions || []}
                recruitmentTitle={recruitment.title}
                recruitmentId={id}
                currentPage={page}
                totalPages={totalPages}
            />
        </div>
    );
}
