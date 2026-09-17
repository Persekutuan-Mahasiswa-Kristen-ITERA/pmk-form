"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoldenParticles } from "@/components/GoldenParticles";
import { BibleVerseBanner } from "@/components/BibleVerseBanner";
import { FormFieldRenderer } from "@/components/FormFieldRenderer";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { FieldConfig } from "@/types/forms";
import { FormFieldRenderer as GenericFormFieldRenderer } from "@/components/FormFieldRenderer";

interface RecruitmentPageProps {
  params: { slug: string };
}

export default function RecruitmentPage({ params }: RecruitmentPageProps) {
  const router = useRouter();
  const { slug } = params;
  const [recruitmentData, setRecruitmentData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchRecruitment() {
      try {
        const { data, error } = await supabase
          .from("recruitments")
          .select("*")
          .eq("slug", slug)
          .single();

        if (error || !data) {
          setError("Recruitment not found or no longer available.");
        } else {
          setRecruitmentData(data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load recruitment data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchRecruitment();
  }, [slug, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !recruitmentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <CardContent>
            <CardTitle className="text-xl font-bold text-foreground mb-2">Recruitment Tidak Tersedia</CardTitle>
            <p className="text-muted-foreground">{error || "Data pendaftaran tidak ditemukan."}</p>
            <Button variant="ghost" asChild className="mt-4">
              <Link href="/">Kembali ke Beranda</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recruitment = recruitmentData;
  const isOpen = recruitment.is_open && new Date(recruitment.close_date) > new Date();

  if (!isOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-10 text-center border-t-8 border-t-accent">
          <CardContent className="space-y-6">
            <h1 className="font-serif text-3xl font-bold text-foreground">Pendaftaran Ditutup</h1>
            <p className="text-muted-foreground">Pendaftaran untuk <strong>{recruitment.title}</strong> telah ditutup.</p>
            <Button variant="ghost" asChild>
              <Link href="/">Kembali ke Beranda</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pt-12 pb-16 px-4 bg-[#FAF6F0]">
      <Card className="max-w-3xl w-full shadow-xl bg-white rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/10 pb-6">
          <CardTitle className="font-serif text-2xl md:text-3xl text-center text-foreground">{recruitment.title}</CardTitle>
          <CardDescription className="text-center text-muted-foreground mt-2">{recruitment.description || "Deskripsi tidak tersedia."}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Recruitment-specific settings */}
          {recruitment?.settings?.allowed_angkatan && (
            <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
              <Label className="font-semibold text-foreground mb-2 block">Persyaratan Angkatan</Label>
              <p className="text-sm text-muted-foreground">
                Pendaftar harus berasal dari angkatan: {recruitment.settings.allowed_angkatan.join(", ")}
              </p>
            </div>
          )}

          {/* Render Dynamic Form */}
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {recruitment?.form_fields?.map((field: FieldConfig) => (
              <GenericFormFieldRenderer key={field.id} fieldConfig={field} control={{} as any} />
            ))}
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-4 rounded-xl font-bold" disabled>Kirim</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}