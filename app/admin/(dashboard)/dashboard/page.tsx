import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Briefcase, FileText, PlusCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const revalidate = 0;

export default async function DashboardPage() {
    const supabase = await createClient();

    // 1. Fetch Total Pendaftar
    const { count: totalPendaftar } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: true });

    // 2. Fetch Recruitments
    const { data: allRecruitments } = await supabase
        .from("recruitments")
        .select("id, is_open, close_date");

    const activeRecruitments = allRecruitments?.filter(r => r.is_open && new Date(r.close_date) > new Date()) || [];
    const closedRecruitments = allRecruitments?.length ? allRecruitments.length - activeRecruitments.length : 0;

    // 3. Recent 5 Submissions
    const { data: recentSubmissions } = await supabase
        .from("submissions")
        .select("id, applicant_name, applicant_nim, submitted_at, recruitments(title)")
        .order("submitted_at", { ascending: false })
        .limit(5);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-border/50">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-primary">Dashboard</h1>
                    <p className="text-foreground/70 mt-1 font-medium">Ringkasan pendaftaran pelayanan PMK ITERA</p>
                </div>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl shadow-md w-full md:w-auto py-6">
                    <Link href="/admin/recruitments/new">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        Buat Recruitment Baru
                    </Link>
                </Button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-t-4 border-t-primary shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Pendaftar</CardTitle>
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-serif font-bold text-foreground">{totalPendaftar || 0}</div>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-accent shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Recruitment Aktif</CardTitle>
                        <div className="bg-accent/20 p-2 rounded-lg">
                            <Briefcase className="w-5 h-5 text-accent-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-serif font-bold text-foreground">{activeRecruitments.length}</div>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-muted-foreground/30 shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Selesai / Ditutup</CardTitle>
                        <div className="bg-muted p-2 rounded-lg">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-serif font-bold text-foreground">{closedRecruitments}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Submissions */}
            <Card className="shadow-sm border border-border/50 bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-[#FAF6F0]/50 border-b border-border/50 pb-5">
                    <div className="flex items-center justify-between py-1">
                        <div>
                            <CardTitle className="font-serif text-2xl font-bold text-foreground">Pendaftar Terbaru</CardTitle>
                            <CardDescription className="text-sm mt-1">5 pendaftar terakhir dari semua recruitment</CardDescription>
                        </div>
                        <Button variant="ghost" asChild className="text-primary hover:text-primary hover:bg-highlight/50 rounded-xl px-4">
                            <Link href="/admin/recruitments">Lihat Semua <ArrowRight className="w-4 h-4 ml-2" /></Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                        {recentSubmissions && recentSubmissions.length > 0 ? (
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            recentSubmissions.map((sub: any) => (
                                <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-highlight/10 transition-colors">
                                    <div>
                                        <p className="font-semibold text-foreground text-lg">{sub.applicant_name}</p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                            <span className="font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-primary/20">{sub.applicant_nim}</span>
                                            <span className="text-border mx-1">•</span>
                                            <span className="font-medium text-foreground/70">{sub.recruitments?.title || "Unknown"}</span>
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-4 sm:mt-0 font-medium bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/50">
                                        {new Date(sub.submitted_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center text-muted-foreground font-medium flex flex-col items-center">
                                <Users className="w-12 h-12 text-muted mb-4" />
                                Belum ada pendaftar sama sekali.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
