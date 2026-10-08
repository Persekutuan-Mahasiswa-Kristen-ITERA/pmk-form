import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface FormCardProps {
    slug: string;
    title: string;
    description: string;
    closeDate: string;
    formType: string;
}

export function FormCard({ slug, title, description, closeDate, formType }: FormCardProps) {
    const deadline = new Date(closeDate);
    const isClosingSoon = deadline.getTime() - new Date().getTime() < 3 * 24 * 60 * 60 * 1000; // 3 days

    // Semua jenis form sekarang memakai route generik /form/[slug] (Fase 1).
    // Cabang lama isRecruitment ? `/form/${slug}` : `/form/${slug}` selalu
    // menghasilkan nilai yang sama -> dead code, dihapus (Fase 2-2).
    const href = `/form/${slug}`;
    const isRecruitment = formType === "recruitment";

    const badgeColors: Record<string, string> = {
        recruitment: "bg-primary text-primary-foreground",
        event: "bg-amber-600 text-white",
        survey: "bg-blue-600 text-white",
        presensi: "bg-emerald-600 text-white",
        general: "bg-secondary text-secondary-foreground",
    };

    return (
        <Card className="flex flex-col border-[#D4AF37] bg-[#FAF6F0] rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group">
            <div className="h-2 w-full bg-gradient-to-r from-primary to-accent" />
            <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                    <Badge className={`capitalize text-[10px] ${badgeColors[formType] || badgeColors.general}`}>
                        {formType}
                    </Badge>
                    {isClosingSoon && (
                        <div className="flex items-center text-xs text-destructive font-semibold bg-destructive/10 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 mr-1" /> Segera Ditutup
                        </div>
                    )}
                </div>
                <CardTitle className="font-serif text-2xl text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {title}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-muted-foreground text-xs">
                    {description || "Tidak ada deskripsi."}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
                <div className="flex items-center text-xs text-foreground/80 font-medium">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-primary" />
                    Batas: {deadline.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
            </CardContent>
            <CardFooter>
                <Button asChild className="min-h-[44px] w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-xl group-hover:scale-[1.02] transition-transform">
                    <Link href={href}>
                        {isRecruitment ? "Daftar Sekarang" : "Isi Form"} <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
