"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { uploadFormAttachment } from "@/app/actions/uploadFile";
import { submitFormResponseAction } from "@/app/actions/submitResponse";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PMK_LOGO_URL } from "@/components/PMKLogo";
import type { Form as GenericForm, FieldConfig, FieldOption } from "@/types/forms";

// Normalize generic FieldConfig -> renderer FieldConfig
function toRendererConfig(f: FieldConfig): import("./FormFieldRenderer").FieldConfig {
  // F2-3: pemetaan tipe field (email/phone/url/number -> short_text dst.) DIHAPUS.
  // Sebelumnya semua tipe "bernilai" di-collapse ke short_text sehingga
  // <input type> selalu "text" (email/tel/url/number tidak terpakai). Karena
  // FormFieldRenderer sudah punya case untuk email/phone/url/number, tipe
  // diteruskan apa adanya agar <input type> benar.
  //
  // Normalisasi string-option DIPERTAHANKAN: data produksi (7 form, 12 field)
  // menyimpan options sebagai string[], sedangkan renderer butu {label,value}.
  const options = f.options
    ? f.options.map((o: string | FieldOption) =>
        typeof o === "string"
          ? { label: o, value: o.toLowerCase().replace(/[^a-z0-9]/g, "_") }
          : o
      )
    : undefined;

  return {
    id: f.id,
    type: f.type as import("./FormFieldRenderer").FieldConfig["type"],
    label: f.label,
    placeholder: f.placeholder,
    required: f.required ?? false,
    options,
    // 11 helper text produksi memakai `helperText`; baca keduanya.
    helpText: f.helpText ?? f.helperText,
  };
}

export function GenericFormRenderer({ form: genericForm }: { form: GenericForm }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fields: FieldConfig[] = genericForm.form_fields || [];
  const rendererFields = fields.map(toRendererConfig);

  // Build dynamic Zod schema. Keep concrete schemas until refinements are applied;
  // assigning everything to ZodTypeAny too early removes methods such as min().
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  fields.forEach((field) => {
    if (field.type === "file_upload") {
      let validator = z.custom<File>();
      validator = validator.refine((file) => !file || file.size <= 10 * 1024 * 1024, {
        message: "Ukuran file maksimal 10 MB",
      });
      schemaShape[field.id] = field.required
        ? validator.refine((file) => !!file, { message: `${field.label} wajib diupload.` })
        : validator.optional();
      return;
    }

    if (field.type === "checkbox" && field.options && field.options.length > 0) {
      schemaShape[field.id] = field.required
        ? z.array(z.string()).min(1, `Pilih minimal satu opsi untuk ${field.label}.`)
        : z.array(z.string()).optional();
      return;
    }

    if (field.type === "checkbox") {
      const validator = z.boolean();
      schemaShape[field.id] = field.required
        ? validator.refine((value) => value === true, { message: "Anda harus menyetujui pernyataan ini." })
        : validator.optional();
      return;
    }

    const validator = z.string();
    schemaShape[field.id] = field.required
      ? validator.min(1, `${field.label} wajib diisi.`)
      : validator.optional();
  });

  const formSchema = z.object(schemaShape);

  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {} as Record<string, unknown>,
  });

  const onSubmit = async (values: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const answers: Record<string, unknown> = {};

      // Use a stable key for file path; try common identity fields
      const respondentKeyRaw =
        (values["field_applicant_nim"] as string) ||
        (values["applicant_nim"] as string) ||
        (values["nim"] as string) ||
        "anonymous";

      for (const field of fields) {
        const raw = values[field.id];

        if (field.type === "file_upload" && raw instanceof File) {
          const fd = new FormData();
          fd.append("file", raw);
          fd.append("formId", genericForm.id);
          fd.append("respondentKey", String(respondentKeyRaw));

          const result = await uploadFormAttachment(fd);
          if (!result.success || !result.url) {
            throw new Error(result.error || `Gagal mengupload ${field.label}`);
          }
          answers[field.id] = result.url;
        } else {
          answers[field.id] = raw ?? null;
        }
      }

      const result = await submitFormResponseAction({
        formId: genericForm.id,
        answers,
      });

      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan respons. Silakan coba lagi.");
      }

      router.push(`/form/${genericForm.slug}/success`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
      alert(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto pb-24 px-4 sm:px-6 relative z-10">
      <div className="mb-6">
        <Button variant="ghost" asChild className="hover:bg-primary/10 text-primary">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Beranda
          </Link>
        </Button>
      </div>

      <Card className="border-t-8 border-t-accent shadow-xl bg-[#FAF6F0] rounded-3xl overflow-hidden">
        <CardHeader className="bg-white pb-8 border-b border-border/50">
          <div className="w-full flex items-center justify-center">
            <div className="relative w-32 h-32 md:w-40 md:h-40 mb-2 rounded-full border-4 border-accent shadow-lg bg-white flex items-center justify-center p-2 z-10 overflow-hidden">
              <Image
                src={PMK_LOGO_URL}
                alt="PMK ITERA Logo"
                width={150}
                height={150}
                className="object-contain"
                priority
              />
            </div>
          </div>
          <CardTitle className="font-serif text-3xl md:text-4xl text-primary font-bold">{genericForm.title}</CardTitle>
          {genericForm.description && (
            <CardDescription className="text-base text-foreground/80 mt-4 whitespace-pre-wrap leading-relaxed">
              {genericForm.description}
            </CardDescription>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Jenis: <span className="font-semibold capitalize">{genericForm.form_type}</span> • Tutup:{" "}
            {new Date(genericForm.close_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </CardHeader>

        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {rendererFields.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Form ini belum memiliki pertanyaan.</p>
              ) : (
                rendererFields.map((rf) => (
                  <FormFieldRenderer key={rf.id} fieldConfig={rf} control={form.control} />
                ))
              )}

              <div className="pt-8">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full text-lg py-6 bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl shadow-lg transition-transform hover:scale-[1.01]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-3 animate-spin" /> Sedang Mengirim...
                    </>
                  ) : (
                    "Kirim Respons"
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground mt-4 font-medium italic">
                  Pastikan semua data sudah terisi dengan benar.
                </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
