"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  ArrowLeft,
  Copy,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createFormAction, updateFormAction } from "@/app/actions/forms";
import { revalidateForm } from "@/app/actions/revalidate";
import type { Form, FieldConfig, FieldType, FormType, FormSettings } from "@/types/forms";

const FIELD_TYPES: { type: FieldType; label: string; description: string }[] = [
  { type: "short_text", label: "Teks Pendek", description: "Input satu baris (nama, judul, dsb)" },
  { type: "long_text", label: "Teks Panjang / Paragraf", description: "Input beberapa baris (alasan, deskripsi)" },
  { type: "email", label: "Email", description: "Input email dengan validasi format" },
  { type: "phone", label: "Nomor Telepon", description: "Input angka untuk nomor telepon/WhatsApp" },
  { type: "url", label: "URL / Tautan", description: "Input tautan web dengan validasi format" },
  { type: "number", label: "Angka", description: "Input angka saja" },
  { type: "dropdown", label: "Dropdown (Pilihan Tunggal)", description: "Daftar pilihan bertingkat" },
  { type: "radio", label: "Radio Button", description: "Pilihan tunggal berbentuk tombol radio" },
  { type: "checkbox", label: "Checkbox (Pilihan Berganda)", description: "Pilihan yang bisa dicentang lebih dari satu" },
  { type: "date", label: "Tanggal", description: "Pemilih tanggal" },
  { type: "file_upload", label: "Upload Lampiran", description: "Unggah dokumen (PDF, JPG, PNG, DOC)" },
  // CATATAN: tipe berikut ADA di FieldType tetapi BELUM DIDUKUNG renderer
  // (tidak punya case di FormFieldRenderer). Jangan ditawarkan sampai
  // renderer mendukungnya — lihat docs/FORM_CONFIG_MATRIX.md.
  // { type: "datetime", ... }, { type: "address", ... },
];

const FORM_TYPES: { value: FormType; label: string }[] = [
  { value: "general", label: "Umum / General" },
  { value: "recruitment", label: "Open Recruitment" },
  { value: "event", label: "Pendaftaran Acara / Event" },
  { value: "survey", label: "Survei / Kuisioner" },
  { value: "presensi", label: "Presensi / Kehadiran" },
];

function SortableFieldItem({
  field,
  onUpdate,
  onRemove,
  onDuplicate,
}: {
  field: FieldConfig;
  onUpdate: (updated: FieldConfig) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleAddOption = () => {
    const options = field.options || [];
    const newOptNum = options.length + 1;
    onUpdate({ ...field, options: [...options, { label: `Opsi ${newOptNum}`, value: `opsi_${newOptNum}` }] });
  };

  const handleUpdateOption = (index: number, label: string) => {
    const options = [...(field.options || [])];
    options[index] = { label, value: label.toLowerCase().replace(/[^a-z0-9]/g, "_") };
    onUpdate({ ...field, options });
  };

  const handleRemoveOption = (index: number) => {
    onUpdate({ ...field, options: (field.options || []).filter((_, i) => i !== index) });
  };

  const hasOptions = field.type === "dropdown" || field.type === "radio" || field.type === "checkbox";

  return (
    <div ref={setNodeRef} style={style} className="bg-card border rounded-xl p-4 space-y-4 shadow-sm mb-4">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1">
            <GripVertical className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary text-secondary-foreground uppercase tracking-wider">
            {FIELD_TYPES.find((t) => t.type === field.type)?.label || field.type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} title="Duplikat"><Copy className="w-4 h-4 text-muted-foreground" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} title="Hapus"><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs font-semibold">Label Pertanyaan / Field Name *</Label>
          <Input value={field.label} onChange={(e) => onUpdate({ ...field, label: e.target.value })} placeholder="Contoh: Nama Lengkap / Alasan Mendaftar" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Placeholder (Opsional)</Label>
          <Input value={field.placeholder || ""} onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })} placeholder="Contoh: Tuliskan jawaban Anda..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Teks Bantuan / Helper Text (Opsional)</Label>
          <Input value={field.helpText || ""} onChange={(e) => onUpdate({ ...field, helpText: e.target.value })} placeholder="Contoh: Format PDF maks 10MB" />
        </div>
      </div>
      {hasOptions && (
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs font-semibold">Daftar Opsi Pilihan</Label>
          <div className="space-y-2">
            {(field.options || []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={opt.label} onChange={(e) => handleUpdateOption(idx, e.target.value)} placeholder={`Opsi ${idx + 1}`} className="h-9 text-sm" />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleRemoveOption(idx)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Tambah Opsi</Button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <div className="flex items-center space-x-2">
          <Switch id={`req-${field.id}`} checked={field.required ?? false} onCheckedChange={(checked) => onUpdate({ ...field, required: checked })} />
          <Label htmlFor={`req-${field.id}`} className="cursor-pointer text-xs font-medium">Wajib Diisi (Required)</Label>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">ID: {field.id}</span>
      </div>
    </div>
  );
}

export function GenericFormBuilder({ initialData }: { initialData?: Form | null }) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [formType, setFormType] = useState<FormType>(initialData?.form_type || "general");
  const [isOpen, setIsOpen] = useState(initialData?.is_open ?? true);
  const [openDate, setOpenDate] = useState(() =>
    initialData?.open_date
      ? new Date(initialData.open_date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [closeDate, setCloseDate] = useState(() =>
    initialData?.close_date
      ? new Date(initialData.close_date).toISOString().slice(0, 16)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [fields, setFields] = useState<FieldConfig[]>(initialData?.form_fields || []);
  const [settings, setSettings] = useState<FormSettings>(
    initialData?.settings || {
      allowed_angkatan: [2022, 2023, 2024, 2025, 2026],
      wa_group_link: "",
      collect_identity: true,
      thank_you_message: "Terima kasih telah mengisi form ini!",
    }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "settings">("fields");

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const generateSlug = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9 -]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const val = e.target.value; setTitle(val); if (!initialData) setSlug(generateSlug(val)); };

  const handleAddField = (type: FieldType) => {
    // F2-6: crypto.randomUUID() bersifat murni (bukan impure seperti Date.now()),
    // sehingga aman dipanggil menurut aturan purity React Compiler. ID tetap unik.
    const newId = `field_${crypto.randomUUID()}`;
    const defaultLabel = FIELD_TYPES.find((t) => t.type === type)?.label || "Pertanyaan Baru";
    const newField: FieldConfig = { id: newId, type, label: defaultLabel, required: false, options: type === "dropdown" || type === "radio" || type === "checkbox" ? [{ label: "Opsi 1", value: "opsi_1" }, { label: "Opsi 2", value: "opsi_2" }] : undefined };
    setFields((prev) => [...prev, newField]);
  };
  const handleUpdateField = (index: number, updated: FieldConfig) => setFields((prev) => { const next = [...prev]; next[index] = updated; return next; });
  const handleRemoveField = (index: number) => setFields((prev) => prev.filter((_, i) => i !== index));
  const handleDuplicateField = (index: number) => { const target = fields[index]; setFields((prev) => [...prev.slice(0, index + 1), { ...target, id: `field_${crypto.randomUUID()}`, label: `${target.label} (Salinan)` }, ...prev.slice(index + 1)]); };
  const handleDragEnd = (event: DragEndEvent) => { const { active, over } = event; if (over && active.id !== over.id) { setFields((items) => { const oldIndex = items.findIndex((i) => i.id === active.id); const newIndex = items.findIndex((i) => i.id === over.id); return arrayMove(items, oldIndex, newIndex); }); } };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast({ title: "Error", description: "Judul form wajib diisi.", variant: "destructive" }); return; }
    if (!slug.trim()) { toast({ title: "Error", description: "Slug wajib diisi.", variant: "destructive" }); return; }
    if (fields.length === 0) { toast({ title: "Error", description: "Tambahkan setidaknya 1 field pertanyaan.", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      const payload = { title, description: description || null, slug, form_type: formType, is_open: isOpen, open_date: new Date(openDate).toISOString(), close_date: new Date(closeDate).toISOString(), form_fields: fields, settings, created_by: null };
      if (initialData) { const res = await updateFormAction(initialData.id, payload); if (!res.success) throw new Error(res.error); toast({ title: "Berhasil", description: "Form berhasil diperbarui." }); }
      else { const res = await createFormAction(payload); if (!res.success) throw new Error(res.error); toast({ title: "Berhasil", description: "Form baru berhasil dibuat." }); }
      await revalidateForm(slug);
      router.push("/admin/forms");
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : "Gagal menyimpan form"; toast({ title: "Error", description: msg, variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/admin/forms")}><ArrowLeft className="w-4 h-4 mr-1" /> Kembali</Button>
          <div>
            <h1 className="text-2xl font-bold">{initialData ? "Edit Form" : "Buat Form Baru"}</h1>
            <p className="text-xs text-muted-foreground">Konfigurasi pertanyaan dan pengaturan form generik</p>
          </div>
        </div>
        <Button type="submit" disabled={isSaving} className="bg-primary"><Save className="w-4 h-4 mr-2" />{isSaving ? "Menyimpan..." : "Simpan Form"}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Informasi Dasar Form</CardTitle><CardDescription>Judul, jenis form, dan tanggal aktif</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1 md:col-span-2"><Label>Judul Form *</Label><Input value={title} onChange={handleTitleChange} placeholder="Contoh: Pendaftaran Presensi Ibadah Jumat" required /></div>
            <div className="space-y-1"><Label>Jenis Form</Label><Select value={formType} onValueChange={(val: FormType) => setFormType(val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORM_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent></Select></div>
          </div>
          <div className="space-y-1"><Label>Deskripsi / Instruksi</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Jelaskan tujuan form atau petunjuk pengisian..." rows={2} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1"><Label>Slug URL *</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pendaftaran-presensi" required /><p className="text-[11px] text-muted-foreground">URL Publik: /form/{slug || "..."}</p></div>
            <div className="space-y-1"><Label>Tanggal Buka</Label><Input type="datetime-local" value={openDate} onChange={(e) => setOpenDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Tanggal Tutup</Label><Input type="datetime-local" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></div>
          </div>
          <div className="flex items-center space-x-2 pt-2"><Switch id="form-is-open" checked={isOpen} onCheckedChange={setIsOpen} /><Label htmlFor="form-is-open" className="cursor-pointer">Form Buka / Aktif</Label></div>
        </CardContent>
      </Card>
      <div className="flex border-b gap-2">
        <Button type="button" variant={activeTab === "fields" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("fields")}>Editor Pertanyaan ({fields.length})</Button>
        <Button type="button" variant={activeTab === "settings" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("settings")}><SettingsIcon className="w-4 h-4 mr-1" /> Pengaturan Tambahan</Button>
      </div>
      {activeTab === "fields" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-3">
            <Card><CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Tambah Field Pertanyaan</CardTitle><CardDescription className="text-xs">Klik tipe field untuk menambahkan</CardDescription></CardHeader><CardContent className="p-4 pt-0 space-y-2">{FIELD_TYPES.map((ft) => (<Button key={ft.type} type="button" variant="outline" size="sm" className="w-full justify-start text-xs h-auto py-2 px-3 text-left" onClick={() => handleAddField(ft.type)}><Plus className="w-3.5 h-3.5 mr-2 shrink-0 text-primary" /><div><div className="font-medium">{ft.label}</div></div></Button>))}</CardContent></Card>
          </div>
          <div className="md:col-span-3">
            {fields.length === 0 ? (<Card className="border-dashed p-8 text-center"><p className="text-muted-foreground text-sm">Belum ada pertanyaan. Pilih tipe field dari panel sebelah kiri.</p></Card>) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  {fields.map((field, idx) => (<SortableFieldItem key={field.id} field={field} onUpdate={(updated) => handleUpdateField(idx, updated)} onRemove={() => handleRemoveField(idx)} onDuplicate={() => handleDuplicateField(idx)} />))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}
      {activeTab === "settings" && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Pengaturan Tambahan</CardTitle><CardDescription>Grup WhatsApp, kustomisasi pesan, dan pengumpulan identitas</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Link Group WhatsApp (Opsional)</Label>
              <Input value={settings.wa_group_link || ""} onChange={(e) => setSettings({ ...settings, wa_group_link: e.target.value })} placeholder="https://chat.whatsapp.com/..." />
              <p className="text-xs text-muted-foreground">Tautan grup WA yang ditampilkan kepada pengisi setelah berhasil mengisi form.</p>
            </div>
            <div className="space-y-1">
              <Label>Pesan Terima Kasih setelah Submit</Label>
              <Textarea value={settings.thank_you_message || ""} onChange={(e) => setSettings({ ...settings, thank_you_message: e.target.value })} placeholder="Terima kasih telah berpartisipasi..." rows={2} />
            </div>
            {formType === "recruitment" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Persyaratan Angkatan (Opsional)</Label>
                <div className="flex flex-wrap gap-2">
                  {[2024, 2025, 2026].map((angkatan) => {
                    const isSelected = (settings.allowed_angkatan || []).includes(angkatan);
                    return (
                      <button
                        key={angkatan}
                        type="button"
                        onClick={() => {
                          const current = settings.allowed_angkatan || [];
                          const next = isSelected ? current.filter((a: number) => a !== angkatan) : [...current, angkatan];
                          setSettings({ ...settings, allowed_angkatan: next });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-secondary"}`}
                      >
                        Angkatan {angkatan}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">Pilih angkatan (2024-2026) yang boleh mengisi form Open Recruitment ini.</p>
              </div>
            )}
            <div className="flex items-center space-x-2 pt-2">
              <Switch id="collect-id" checked={settings.collect_identity ?? true} onCheckedChange={(val) => setSettings({ ...settings, collect_identity: val })} />
              <Label htmlFor="collect-id" className="cursor-pointer">Kumpulkan Identitas Otomatis (Nama/NIM/Email/Prodi)</Label>
            </div>

            {/* Fase 7-2: verifikasi anti-bot Cloudflare Turnstile di submit publik. */}
            <div className="flex items-center space-x-2">
              <Switch
                id="require-captcha"
                checked={settings.require_captcha ?? true}
                onCheckedChange={(val) => setSettings({ ...settings, require_captcha: val })}
              />
              <Label htmlFor="require-captcha" className="cursor-pointer">
                Verifikasi Anti-Bot (Cloudflare Turnstile)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Hanya berlaku jika site key Turnstile sudah dikonfigurasi (env server). Nonaktifkan
              untuk form internal yang dipercaya.
            </p>
          </CardContent>
        </Card>
      )}
    </form>
  );
}