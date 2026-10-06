import React from "react";
import Link from "next/link";
import { Plus, FileText, Users, Eye, Edit, Calendar, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllForms, countResponsesForForms, countActiveForms } from "@/lib/forms";
import { FormQuickActions } from "@/components/FormQuickActions";
import type { Form, FormType } from "@/types/forms";

export const revalidate = 60; // Fase 8-4: ISR 60s (dulunya 0 = no cache)

export default async function FormsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedType = (resolvedParams.type as FormType) || undefined;

  const { data: forms, count: totalForms } = await getAllForms({
    formType: selectedType,
    page: 1,
    pageSize: 50,
  });

  const activeCount = await countActiveForms();

  // Batch-count response counts for all forms in one query (replaces N+1).
  const responseCounts = await countResponsesForForms(forms.map((f) => f.id));
  const formsWithCounts = forms.map((form) => ({
    ...form,
    responseCount: responseCounts[form.id] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Form</h1>
          <p className="text-muted-foreground">
            Kelola seluruh jenis form (presensi, survei, event, recruitment)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/forms/trash">
            <Button variant="outline">
              <Trash2 className="w-4 h-4 mr-2" /> Sampah
            </Button>
          </Link>
          <Link href="/admin/forms/new">
            <Button className="bg-primary">
              <Plus className="w-4 h-4 mr-2" /> Buat Form Baru
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Total Form</CardDescription>
            <CardTitle className="text-2xl">{totalForms}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Form Buka / Aktif</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b pb-3 overflow-x-auto">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground mr-2">Filter Jenis:</span>
        <FilterChip label="Semua" href="/admin/forms" active={!selectedType} />
        <FilterChip label="Recruitment" href="/admin/forms?type=recruitment" active={selectedType === "recruitment"} />
        <FilterChip label="Event" href="/admin/forms?type=event" active={selectedType === "event"} />
        <FilterChip label="Survei" href="/admin/forms?type=survey" active={selectedType === "survey"} />
        <FilterChip label="Presensi" href="/admin/forms?type=presensi" active={selectedType === "presensi"} />
        <FilterChip label="Umum" href="/admin/forms?type=general" active={selectedType === "general"} />
      </div>

      {formsWithCounts.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-muted-foreground text-sm">
            Belum ada form untuk filter ini. Klik &quot;Buat Form Baru&quot; untuk menambahkan.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formsWithCounts.map((form) => (
            <FormAdminCard key={form.id} form={form} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      }`}
    >
      {label}
    </Link>
  );
}

function FormAdminCard({ form }: { form: Form & { responseCount: number } }) {
  const isExpired = new Date(form.close_date) < new Date();

  return (
    <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant={form.form_type === "recruitment" ? "default" : "outline"} className="capitalize text-[10px]">
            {form.form_type}
          </Badge>

          <Badge
            variant={form.is_open && !isExpired ? "default" : "secondary"}
            className={form.is_open && !isExpired ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {form.is_open && !isExpired ? "Buka" : "Tutup"}
          </Badge>
        </div>

        <CardTitle className="text-lg font-bold line-clamp-1">{form.title}</CardTitle>
        <CardDescription className="text-xs line-clamp-2">
          {form.description || "Tidak ada deskripsi."}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{form.responseCount} Respons</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Tutup: {new Date(form.close_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3 gap-2">
          <Link href={`/form/${form.slug}`} target="_blank" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Pratinjau
          </Link>

          <div className="flex items-center gap-1">
            <FormQuickActions formId={form.id} isOpen={form.is_open} responseCount={form.responseCount} />

            <Link href={`/admin/forms/${form.id}/responses`}>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <FileText className="w-3.5 h-3.5 mr-1" /> Respons ({form.responseCount})
              </Button>
            </Link>

            <Link href={`/admin/forms/${form.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
