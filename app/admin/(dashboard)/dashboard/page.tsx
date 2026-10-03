import { getAllForms } from "@/lib/forms";
import { computeFormStats } from "@/components/landing";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Briefcase, FileText, PlusCircle, ArrowRight, Calendar, BarChart3 } from "lucide-react";

export const revalidate = 0;

export default async function DashboardPage() {
  // F2-1: data-access layer tunggal — pakai getAllForms() (sudah requireAdmin).
  const { data: forms } = await getAllForms();

  // F2-4 + F2-5: statistik memakai computeFormStats (sumber: isFormActive),
  // bukan new Date() yang tersebar di body komponen (aturan purity React).
  const stats = computeFormStats(forms);
  const totalForms = stats.total;
  const openForms = stats.activeCount;
  const upcomingForms = stats.closingSoon;
  const closedForms = stats.closed;

  // Group by form_type for quick insight
  const typeCounts: Record<string, number> = {};
  forms.forEach(f => {
    typeCounts[f.form_type] = (typeCounts[f.form_type] || 0) + 1;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-border/50">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Dashboard Admin</h1>
          <p className="text-foreground/70 mt-1 font-medium">Ringkasan manajemen formulir PMK ITERA</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl shadow-md w-full md:w-auto py-6">
          <Link href="/admin/forms/new">
            <PlusCircle className="w-5 h-5 mr-2" /> Buat Form Baru
          </Link>
        </Button>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Forms */}
        <Card className="border-t-4 border-t-primary shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Formulir</CardTitle>
            <div className="bg-primary/10 p-2 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-serif font-bold text-foreground">{totalForms}</div>
          </CardContent>
        </Card>

        {/* Form Terbuka */}
        <Card className="border-t-4 border-t-accent shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Formulir Terbuka</CardTitle>
            <div className="bg-accent/20 p-2 rounded-lg">
              <Briefcase className="w-5 h-5 text-accent-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-serif font-bold text-foreground">{openForms}</div>
          </CardContent>
        </Card>

        {/* Mendekati Tenggat Waktu */}
        <Card className="border-t-4 border-t-accent shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Segera Tutup (7 hari)</CardTitle>
            <div className="bg-accent/20 p-2 rounded-lg">
              <Calendar className="w-5 h-5 text-accent-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-serif font-bold text-foreground">{upcomingForms}</div>
          </CardContent>
        </Card>

        {/* Form Tertutup */}
        <Card className="border-t-4 border-t-muted-foreground/30 shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Selesai / Ditutup</CardTitle>
            <div className="bg-muted p-2 rounded-lg">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-serif font-bold text-foreground">{closedForms}</div>
          </CardContent>
        </Card>

        {/* Statistik per Jenis Form */}
        <Card className="border-t-4 border-t-accent shadow-sm bg-white rounded-2xl hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Distribusi Jenis Form</CardTitle>
            <div className="bg-accent/20 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-accent-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="capitalize">{type}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity (Optional: recent form submissions or form creations) */}
      <Card className="shadow-sm border border-border/50 bg-white rounded-3xl overflow-hidden">
        <CardHeader className="bg-[#FAF6F0]/50 border-b border-border/50 pb-5">
          <div className="flex items-center justify-between py-1">
            <div>
              <CardTitle className="font-serif text-2xl font-bold text-foreground">Aktivitas Terbaru</CardTitle>
              <CardDescription className="text-sm mt-1">5 aktivitas terakhir (pembuatan/form update)</CardDescription>
            </div>
            <Button variant="ghost" asChild className="text-primary hover:text-primary hover:bg-highlight/50 rounded-xl px-4">
              <Link href="/admin/forms">Lihat Semua Form <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* We could show recent forms or recent submissions; for simplicity, show recent forms */}
          <div className="divide-y divide-border/50">
            {forms && forms.length > 0 ? (
              forms.slice(0, 5).map((form) => (
                <div key={form.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-highlight/10 transition-colors">
                  <div>
                    <p className="font-semibold text-foreground text-lg">{form.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <span className="font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-primary/20">{form.form_type}</span>
                      <span className="text-border mx-1">•</span>
                      <span className="font-medium text-foreground/70">{new Date(form.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mt-4 sm:mt-0 font-medium bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/50">
                    {form.is_open ? "Buka" : "Tutup"}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-muted-foreground font-medium flex flex-col items-center">
                <Users className="w-12 h-12 text-muted mb-4" />
                Belum ada aktivitas formulir.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}