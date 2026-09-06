import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlusCircle, Edit, Users, ExternalLink, Briefcase } from "lucide-react";
import Link from "next/link";
import { RecruitmentToggle } from "./RecruitmentToggle";

export const revalidate = 0;

export default async function ManageRecruitments() {
    const supabase = await createClient();

    const { data: recruitments } = await supabase
        .from("recruitments")
        .select("*, submissions(count)")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-border/50">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-primary">Kelola Recruitment</h1>
                    <p className="text-foreground/70 mt-1 font-medium">Daftar semua acara, kepanitiaan, dan pelayanan.</p>
                </div>
                <Button asChild className="bg-accent hover:bg-[url('/gold-texture.jpg')] hover:bg-accent/90 text-accent-foreground font-bold rounded-xl shadow-md w-full md:w-auto py-6">
                    <Link href="/admin/recruitments/new">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        Buat Baru
                    </Link>
                </Button>
            </div>

            <Card className="rounded-3xl border-2 border-border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-[#FAF6F0]/80 border-b-2 border-border">
                        <TableRow>
                            <TableHead className="font-bold text-foreground font-serif py-4">Judul Event</TableHead>
                            <TableHead className="font-bold text-foreground font-serif">Status</TableHead>
                            <TableHead className="font-bold text-foreground font-serif">Deadline</TableHead>
                            <TableHead className="font-bold text-foreground font-serif text-center">Pendaftar</TableHead>
                            <TableHead className="text-right font-bold text-foreground font-serif">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {recruitments?.map((rec: any) => (
                            <TableRow key={rec.id} className="hover:bg-[#F5E6C8]/30 transition-colors border-b border-border/50">
                                <TableCell className="font-medium py-4">
                                    <span className="text-primary text-lg">{rec.title}</span>
                                    <div className="text-xs text-muted-foreground mt-1.5 font-normal flex items-center">
                                        <span className="bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">/{rec.slug}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <RecruitmentToggle id={rec.id} initialStatus={rec.is_open} />
                                </TableCell>
                                <TableCell className="font-medium text-foreground/80">
                                    {new Date(rec.close_date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="bg-accent/20 text-accent-foreground font-bold px-3 py-1 rounded-full text-sm border border-accent/30">
                                        {rec.submissions[0]?.count || 0}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" asChild className="rounded-xl text-primary hover:text-primary hover:bg-primary/10 border-primary/20">
                                        <Link href={`/recruitment/${rec.slug}`} target="_blank">
                                            <ExternalLink className="w-4 h-4" />
                                        </Link>
                                    </Button>
                                    <Button variant="outline" size="sm" asChild className="rounded-xl text-accent-foreground border-accent hover:bg-accent/10">
                                        <Link href={`/admin/recruitments/${rec.id}`}>
                                            <Edit className="w-4 h-4" />
                                        </Link>
                                    </Button>
                                    <Button size="sm" asChild className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                                        <Link href={`/admin/recruitments/${rec.id}/applicants`}>
                                            <Users className="w-4 h-4 mr-2" /> Data
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!recruitments?.length && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground font-medium">
                                    <div className="flex flex-col items-center justify-center">
                                        <Briefcase className="w-10 h-10 text-muted mb-3" />
                                        Belum ada recruitment. Silakan buat baru.
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
