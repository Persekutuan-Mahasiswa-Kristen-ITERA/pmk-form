import { createClient } from "@/lib/supabase/server";
import { RecruitmentBuilder } from "@/components/RecruitmentBuilder";
import { notFound } from "next/navigation";

export const revalidate = 0;

export default async function EditRecruitmentPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { id } = await params;

    const { data: recruitment } = await supabase
        .from("recruitments")
        .select("*")
        .eq("id", id)
        .single();

    if (!recruitment) notFound();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <RecruitmentBuilder initialData={recruitment} />
        </div>
    );
}
