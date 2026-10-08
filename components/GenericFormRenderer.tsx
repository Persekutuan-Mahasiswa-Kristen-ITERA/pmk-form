"use client";

/**
 * GenericFormRenderer — inti halaman publik `/form/[slug]` (UI Overhaul U3).
 *
 * Logika bisnis TIDAK diubah: skema Zod dinamis, upload lewat
 * `uploadFormAttachment`, submit lewat `submitFormResponseAction`,
 * Turnstile hanya jika `settings.require_captcha !== false` (Fase 7-2).
 *
 * Yang dirombak (prompt U3 & bagian 5):
 * - layout satu kolom mobile-first, tombol kirim jadi **bar aksi bawah sticky**
 *   yang aman safe-area + tidak tertutup keyboard,
 * - indikator progres saat `settings.show_progress` (bidang wajib diisi),
 * - error inline + **scroll otomatis ke error pertama**,
 * - upload file: status unggah + error jelas, petunjuk tipe/ukuran,
 * - toast (bukan `alert`) untuk error submit / rate limit,
 * - tombol kirim menonaktifkan diri saat proses (cegah double submit).
 */
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { uploadFormAttachment } from "@/app/actions/uploadFile";
import { submitFormResponseAction } from "@/app/actions/submitResponse";
import { TurnstileWidget } from "./TurnstileWidget";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, UploadCloud, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PMK_LOGO_URL } from "@/components/PMKLogo";
import { useToast } from "@/hooks/use-toast";
import type { Form as GenericForm, FieldConfig, FieldOption } from "@/types/forms";

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// Normalize generic FieldConfig -> renderer FieldConfig
function toRendererConfig(f: FieldConfig): import("./FormFieldRenderer").FieldConfig {
  // F2-3: pemetaan tipe field (email/phone/url/number -> short_text dst.) DIHAPUS.
  // Sebelumnya semua tipe "bernilai" di-collapse ke short_text sehingga
  // <input type> selalu "text" (email/tel/url/number tidak terpakai). Karena
  // FormFieldRenderer sudah punya case untuk email/phone/url/number, tipe
  // diteruskan apa adanya agar <input type> benar.
  //
  // Normalisasi string-option DIPERTAHANKAN: data produksi (7 form, 12 field)
  // menyimpan options sebagai string[], sedangkan renderer butuh {label,value}.
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

/** Status unggah file per field (prompt U3: "status unggah dan error jelas"). */
type UploadState = "idle" | "uploading" | "done" | "error";

export function GenericFormRenderer({ form: genericForm }: { form: GenericForm }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const submitBarRef = useRef<HTMLDivElement>(null);

  // Fase 7-2: Turnstile aktif hanya jika dikonfigurasi global (env) DAN
  // diaktifkan per-form (settings.require_captcha !== false).
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaEnabled =
    !!turnstileSiteKey && genericForm.settings?.require_captcha !== false;

  const fields: FieldConfig[] = genericForm.form_fields || [];
  const rendererFields = fields.map(toRendererConfig);

  // F4-1 progress: hanya bidang wajib yang dihitung agar indikator stabil.
  const requiredFieldIds = fields.filter((f) => f.required).map((f) => f.id);

  // Build dynamic Zod schema. Keep concrete schemas until refinements are applied;
  // assigning everything to ZodTypeAny too early removes methods such as min().
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  fields.forEach((field) => {
    if (field.type === "file_upload") {
      let validator = z.custom<File>();
      validator = validator.refine((file) => !file || file.size <= MAX_FILE_BYTES, {
        message: `Ukuran file maksimal ${MAX_FILE_MB} MB`,
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

  // U3: defaultValues string kosong (bukan {}) supaya Zod memunculkan pesan
  // spesifik ("X wajib diisi.") alih-alih "Invalid input" generik saat field
  // required dibiarkan kosong. File upload & checkbox-group tetap undefined.
  const defaultValues: Record<string, unknown> = {};
  fields.forEach((field) => {
    if (field.type === "file_upload") return;
    if (field.type === "checkbox" && field.options && field.options.length > 0) return;
    if (field.type === "checkbox") return;
    defaultValues[field.id] = "";
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const showProgress = genericForm.settings?.show_progress === true;

  // Indikator progres = persentase bidang wajib yang sudah terisi.
  const filledCount = requiredFieldIds.filter((id) => {
    const v = form.watch(id);
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  }).length;
  const progress = requiredFieldIds.length
    ? Math.round((filledCount / requiredFieldIds.length) * 100)
    : 100;

  // U3: scroll ke error pertama setelah validasi gagal.
  const onInvalid = () => {
    // requestAnimationFrame agar DOM sudah render pesan error sebelum scroll.
    requestAnimationFrame(() => {
      // shadcn FormItem menandai field bermasalah lewat aria-invalid pada
      // elemen input; label/FormItem sendiri tidak punya penanda lain.
      const firstError = document.querySelector(
        '[aria-invalid="true"]',
      );
      if (firstError instanceof HTMLElement) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.focus({ preventScroll: true });
      }
    });
  };

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
          // Validasi client-side tambahan sebelum upload (prompt U3).
          if (raw.size > MAX_FILE_BYTES) {
            setUploadStates((s) => ({ ...s, [field.id]: "error" }));
            throw new Error(`${field.label}: ukuran melebihi ${MAX_FILE_MB} MB`);
          }
          setUploadStates((s) => ({ ...s, [field.id]: "uploading" }));
          const fd = new FormData();
          fd.append("file", raw);
          fd.append("formId", genericForm.id);
          fd.append("respondentKey", String(respondentKeyRaw));

          const result = await uploadFormAttachment(fd);
          if (!result.success || !result.url) {
            setUploadStates((s) => ({ ...s, [field.id]: "error" }));
            throw new Error(result.error || `Gagal mengupload ${field.label}`);
          }
          setUploadStates((s) => ({ ...s, [field.id]: "done" }));
          answers[field.id] = result.url;
        } else {
          answers[field.id] = raw ?? null;
        }
      }

      const result = await submitFormResponseAction({
        formId: genericForm.id,
        answers,
        turnstileToken: captchaEnabled ? (turnstileToken ?? undefined) : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan respons. Silakan coba lagi.");
      }

      // redirect_url dihormati jika ada (Fase 6/7 behavior dipertahankan).
      const redirectUrl =
        typeof genericForm.settings?.redirect_url === "string"
          ? genericForm.settings.redirect_url
          : `/form/${genericForm.slug}/success`;
      router.push(redirectUrl);
    } catch (err: unknown) {
      // U3: toast ramah, bukan alert(); tetap aman (tidak ada detail DB/stack).
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
      toast({
        variant: "destructive",
        title: "Gagal mengirim",
        description: msg,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-44 pt-8 sm:px-6 sm:pb-32">
      <div className="mb-6">
        <Button variant="ghost" asChild className="text-primary hover:bg-primary/10">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Beranda
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden rounded-3xl border-t-8 border-t-accent bg-[#FAF6F0] shadow-xl">
        <CardHeader className="border-b border-border/50 bg-white pb-8">
          <div className="flex w-full items-center justify-center">
            <div className="relative z-10 mb-2 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-accent bg-white p-2 shadow-lg md:h-40 md:w-40">
              <Image
                src={PMK_LOGO_URL}
                alt="Logo PMK ITERA"
                width={150}
                height={150}
                className="object-contain"
                priority
              />
            </div>
          </div>
          {/* U5 a11y: judul form memakai <h1> (CardTitle me-render <div>,
              bukan heading — setiap halaman harus punya tepat satu <h1>). */}
          <h1 className="font-serif text-3xl font-bold text-primary md:text-4xl">
            {genericForm.title}
          </h1>
          {genericForm.description && (
            <CardDescription className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-foreground/80">
              {genericForm.description}
            </CardDescription>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Jenis: <span className="font-semibold capitalize">{genericForm.form_type}</span> • Tutup:{" "}
            {new Date(genericForm.close_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          {showProgress && requiredFieldIds.length > 0 ? (
            <div className="mt-6 space-y-2" aria-live="polite">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Progres pengisian</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="pt-8">
          <Form {...form}>
            <form
              id="main-form"
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
              className="space-y-6"
              noValidate
            >
              {rendererFields.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  Form ini belum memiliki pertanyaan.
                </p>
              ) : (
                rendererFields.map((rf) => (
                  <div key={rf.id} className="space-y-1.5">
                    <FormFieldRenderer fieldConfig={rf} control={form.control} />
                    {/* Status unggah file (prompt U3) */}
                    {rf.type === "file_upload" && uploadStates[rf.id] ? (
                      <FileUploadStatus
                        state={uploadStates[rf.id]}
                        label={rf.label}
                      />
                    ) : null}
                    {rf.type === "file_upload" ? (
                      <p className="text-xs text-muted-foreground">
                        Maksimal {MAX_FILE_MB} MB. Format umum saja (PDF, JPG, PNG, DOCX).
                      </p>
                    ) : null}
                  </div>
                ))
              )}

              {captchaEnabled && (
                <div className="pt-2">
                  <TurnstileWidget siteKey={turnstileSiteKey as string} onToken={setTurnstileToken} />
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Bar aksi bawah sticky — aman safe-area, tidak tertutup keyboard.
          Tetap dalam viewport normal; pb-44 di atas memberi ruang. */}
      <div
        ref={submitBarRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-[#FAF6F0]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FAF6F0]/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            type="submit"
            form="main-form"
            disabled={isSubmitting}
            className="h-12 flex-1 rounded-2xl bg-accent text-base font-semibold text-accent-foreground shadow-lg transition-transform hover:scale-[1.01] hover:bg-accent/90 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Sedang mengirim…
              </>
            ) : (
              "Kirim Respons"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Teks status unggah yang jelas + ikon (prompt U3). */
function FileUploadStatus({
  state,
  label,
}: {
  state: UploadState;
  label: string;
}) {
  if (state === "uploading") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Mengunggah {label}…
      </p>
    );
  }
  if (state === "done") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {label} berhasil diunggah
      </p>
    );
  }
  if (state === "error") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
        <UploadCloud className="h-3.5 w-3.5" />
        {label} gagal diunggah. Periksa ukuran/koneksi, lalu coba lagi.
      </p>
    );
  }
  return null;
}
FileUploadStatus.displayName = "FileUploadStatus";
