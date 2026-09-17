"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldConfig } from "./FormFieldRenderer";
import { Trash2, GripVertical, Plus, Save, ArrowLeft } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import dynamic from "next/dynamic";
const QRCodeCard = dynamic(() => import("./QRCodeCard").then((mod) => mod.QRCodeCard), { ssr: false });
import { revalidateRecruitment, revalidateAdminData } from "@/app/actions/revalidate";

function SortableFieldItem({ field, updateField, removeField }: { field: FieldConfig, updateField: (id: string, updates: Partial<FieldConfig>) => void, removeField: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <Card ref={setNodeRef} style={style} className="bg-white border-2 border-border shadow-sm mb-4 group hover:border-accent/50 transition-colors">
            <CardContent className="p-5 flex gap-4 items-start">
                <div {...attributes} {...listeners} className="mt-8 cursor-grab text-muted-foreground hover:text-primary active:cursor-grabbing p-1">
                    <GripVertical className="w-6 h-6" />
                </div>
                <div className="flex-1 space-y-5">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="font-semibold text-foreground">Label Pertanyaan</Label>
                            <Input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} placeholder="Contoh: Alasan mendaftar" className="bg-background" />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold text-foreground">Tipe Field</Label>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <Select value={field.type} onValueChange={(val: any) => updateField(field.id, { type: val })}>
                                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="short_text">Teks Singkat</SelectItem>
                                    <SelectItem value="long_text">Teks Panjang</SelectItem>
                                    <SelectItem value="dropdown">Dropdown</SelectItem>
                                    <SelectItem value="radio">Pilihan Ganda (Radio)</SelectItem>
                                    <SelectItem value="checkbox">Kotak Centang (Checkbox)</SelectItem>
                                    <SelectItem value="date">Tanggal</SelectItem>
                                    <SelectItem value="file_upload">Upload File</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-foreground">Placeholder <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                            <Input value={field.placeholder || ''} onChange={e => updateField(field.id, { placeholder: e.target.value })} placeholder="Petunjuk pengisian di dalam kotak..." className="bg-background" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Helper Text <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                            <Input value={field.helperText || ''} onChange={e => updateField(field.id, { helperText: e.target.value })} placeholder="Teks bantuan di bawah pertanyaan..." className="bg-background" />
                        </div>
                    </div>

                    {['dropdown', 'radio', 'checkbox'].includes(field.type) && (
                        <div className="space-y-2 bg-highlight/10 p-4 rounded-xl border border-accent/20">
                            <Label className="text-primary font-semibold">Opsi Pilihan <span className="text-muted-foreground font-normal">(Pisahkan dengan koma)</span></Label>
                            <Input
                                value={field.options?.map((o: any) => typeof o === 'string' ? o : o.label).join(', ') || ''}
                                onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => ({ label: s.trim(), value: s.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") })) })}
                                placeholder="Opsi A, Opsi B, Opsi C"
                                className="bg-white border-accent/40 focus-visible:ring-accent"
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center space-x-3 mt-3">
                            <Switch checked={field.required} onCheckedChange={(c) => updateField(field.id, { required: c })} className="data-[state=checked]:bg-primary" />
                            <Label className="font-semibold cursor-pointer">Wajib Diisi (*)</Label>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeField(field.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-3 rounded-lg">
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus Field
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const TEMPLATES = {
    "Ketua Pelaksana": [
        { id: "t1", type: "long_text", label: "Visi dan Misi", required: true },
        { id: "t2", type: "long_text", label: "Pengalaman Berorganisasi", required: true },
        { id: "t3", type: "short_text", label: "Kekurangan dan Kelebihan Diri", required: true }
    ],
    "Divisi Acara": [
        { id: "a1", type: "long_text", label: "Ide Konsep Acara", required: true },
        { id: "a2", type: "radio", label: "Pernah menjadi MC atau WL?", required: true, options: ["Pernah", "Belum Pernah"] }
    ],
    "Custom": []
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RecruitmentBuilder({ initialData }: { initialData?: any }) {
    const router = useRouter();
    const supabase = createClient();

    const [title, setTitle] = useState(initialData?.title || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [openDate, setOpenDate] = useState(initialData?.open_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
    const [closeDate, setCloseDate] = useState(initialData?.close_date?.split('T')[0] || "");
    const [template, setTemplate] = useState(initialData?.template_type || "Custom");
    const [fields, setFields] = useState<FieldConfig[]>(initialData?.form_fields || []);
    const [isOpen, setIsOpen] = useState(initialData ? initialData.is_open : true);
    const [allowedAngkatan, setAllowedAngkatan] = useState<string>(initialData?.allowed_angkatan?.join(', ') || "2024");
    const [waGroupLink, setWaGroupLink] = useState(initialData?.wa_group_link || "");

    const [isSaving, setIsSaving] = useState(false);
    const [savedUrl, setSavedUrl] = useState("");

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setFields((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const addField = () => {
        setFields([...fields, { id: `field_${Date.now()}_${Math.random().toString(36).substring(2)}`, type: "short_text", label: "Pertanyaan Baru", required: true }]);
    };

    const updateField = (id: string, updates: Partial<FieldConfig>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const handleTemplateChange = (val: string) => {
        setTemplate(val);
        if (val !== "Custom") {
            // @ts-expect-error Types are dynamic based on template
            const templateFields = TEMPLATES[val].map(f => ({ ...f, id: `field_${Date.now()}_${Math.random().toString(36).substring(2)}` }));
            setFields(templateFields);
        }
    };

    const handleSave = async () => {
        if (!title || !closeDate) {
            alert("Judul dan Tanggal Tutup wajib diisi!");
            return;
        }

        if (waGroupLink && !waGroupLink.includes('chat.whatsapp.com')) {
            alert("Link Grup WhatsApp tidak valid. Harus menggunakan link chat.whatsapp.com.");
            return;
        }

        const parsedAngkatan = allowedAngkatan.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

        if (parsedAngkatan.length === 0) {
            alert("Minimal masukkan 1 angkatan yang diperbolehkan mendaftar!");
            return;
        }

        setIsSaving(true);
        const slug = initialData?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        const payload = {
            title,
            description,
            slug,
            is_open: isOpen,
            open_date: new Date(openDate).toISOString(),
            close_date: new Date(closeDate).toISOString(),
            form_fields: fields,
            template_type: template,
            allowed_angkatan: parsedAngkatan,
            wa_group_link: waGroupLink || null,
        };

        let res;
        if (initialData?.id) {
            res = await supabase.from("recruitments").update(payload).eq("id", initialData.id).select();
        } else {
            res = await supabase.from("recruitments").insert(payload).select();
        }

        setIsSaving(false);

        if (res.error) {
            alert("Gagal menyimpan: " + res.error.message);
        } else {
            // Revalidate cached paths
            await revalidateRecruitment(slug);
            await revalidateAdminData();

            const baseUrl = window.location.origin;
            setSavedUrl(`${baseUrl}/recruitment/${slug}`);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    if (savedUrl) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 max-w-2xl mx-auto py-10">
                <div className="text-center space-y-4 mb-8">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-200 shadow-sm">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h2 className="font-serif text-4xl text-primary font-bold">Berhasil Disimpan!</h2>
                    <p className="text-lg text-muted-foreground">Recruitment telah dipublikasikan dan siap menerima pendaftar.</p>
                </div>

                <QRCodeCard url={savedUrl} title={title} />

                <div className="flex justify-center mt-12 gap-4">
                    <Button asChild variant="outline" className="rounded-xl border-accent text-accent-foreground px-8">
                        <Link href="/admin/recruitments">Kembali ke Daftar</Link>
                    </Button>
                    <Button onClick={() => { setSavedUrl(""); router.refresh(); }} className="rounded-xl bg-primary text-primary-foreground px-8 hover:bg-primary/90">
                        Lanjut Edit
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in pb-20">
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" asChild className="hover:bg-primary/10 text-primary -ml-4 rounded-xl">
                    <Link href="/admin/recruitments">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                    </Link>
                </Button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
                        {initialData ? "Edit Recruitment" : "Buat Recruitment Baru"}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">Konfigurasi form pendaftaran secara dinamis.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg px-8 py-6 text-lg transition-transform hover:scale-105">
                    <Save className="w-5 h-5 mr-2" /> {isSaving ? "Menyimpan..." : "Simpan Form"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Basic Info */}
                <Card className="lg:col-span-1 rounded-3xl border-2 border-border bg-white shadow-sm sticky top-24">
                    <CardHeader className="bg-[#FAF6F0] border-b border-border/50 rounded-t-3xl pb-5">
                        <CardTitle className="font-serif text-xl border-b border-accent/30 pb-2">Informasi Dasar</CardTitle>
                        <CardDescription className="text-base mt-2">Atur judul dan deskripsi acara.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                        <div className="space-y-2">
                            <Label className="font-bold text-foreground">Status Pendaftaran</Label>
                            <div className="flex items-center space-x-3 bg-secondary/20 p-3 rounded-xl border border-secondary">
                                <Switch checked={isOpen} onCheckedChange={setIsOpen} className="data-[state=checked]:bg-primary" />
                                <span className="font-semibold text-primary">{isOpen ? "Sedang Dibuka" : "Ditutup"}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold text-foreground">Judul <span className="text-destructive">*</span></Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: OPREC Panitia Natal 2024" className="bg-[#FAF6F0] border-accent/30 focus-visible:ring-accent rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold text-foreground">Deskripsi Singkat</Label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tuliskan sekilas tentang acara ini..." className="min-h-[100px] bg-[#FAF6F0] border-accent/30 focus-visible:ring-accent rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-bold text-foreground">Tgl Buka <span className="text-destructive">*</span></Label>
                                <Input type="date" value={openDate} onChange={e => setOpenDate(e.target.value)} className="bg-[#FAF6F0] rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-foreground">Tgl Tutup <span className="text-destructive">*</span></Label>
                                <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="bg-[#FAF6F0] rounded-xl" />
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-accent/20">
                            <Label className="font-bold text-foreground">Angkatan yang Diperbolehkan Mendaftar</Label>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Masukkan 4 digit angkatan, pisahkan dengan koma (contoh: 2024, 2025).
                            </p>
                            <Input
                                value={allowedAngkatan}
                                onChange={e => setAllowedAngkatan(e.target.value)}
                                placeholder="2024, 2025"
                                className="bg-[#FAF6F0] border-accent/30 focus-visible:ring-accent rounded-xl"
                            />
                        </div>

                        <div className="space-y-3 pt-4 border-t border-accent/20">
                            <Label className="font-bold text-foreground">Link Grup WhatsApp <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Link ini akan ditampilkan kepada pendaftar setelah berhasil mendaftar (Halaman Success).
                            </p>
                            <Input
                                type="url"
                                value={waGroupLink}
                                onChange={e => setWaGroupLink(e.target.value)}
                                placeholder="https://chat.whatsapp.com/xxxxxx"
                                className="bg-[#FAF6F0] border-accent/30 focus-visible:ring-accent rounded-xl"
                            />
                            {waGroupLink && waGroupLink.includes('chat.whatsapp.com') && (
                                <div className="mt-4 flex flex-col items-center p-4 bg-white rounded-xl border-2 border-dashed border-accent/50 shadow-sm">
                                    <p className="text-sm font-semibold text-primary mb-3">Preview QR Code WhatsApp</p>
                                    <QRCodeCard url={waGroupLink} title="Group WhatsApp" hideLink={true} hideIcon={true} />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Builder */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-3xl border-2 border-accent shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-highlight/20 border-b border-accent/20 pb-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="font-serif text-2xl text-primary font-bold border-b border-accent/30 pb-2 inline-block">Form Builder</CardTitle>
                                    <CardDescription className="text-base mt-2 text-foreground/80">Susun pertanyaan khusus (di luar data diri & spiritualitas standar PMK).</CardDescription>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Label className="font-semibold whitespace-nowrap text-primary">Template:</Label>
                                    <Select value={template} onValueChange={handleTemplateChange}>
                                        <SelectTrigger className="w-[180px] bg-white border-accent/40 rounded-xl font-medium"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(TEMPLATES).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8 px-4 sm:px-8 bg-[#FAF6F0]/30">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                    {fields.map((field) => (
                                        <SortableFieldItem key={field.id} field={field} updateField={updateField} removeField={removeField} />
                                    ))}
                                </SortableContext>
                            </DndContext>

                            {fields.length === 0 && (
                                <div className="text-center py-10 bg-white border-2 border-dashed border-border rounded-2xl mb-6">
                                    <p className="text-muted-foreground font-medium text-lg">Belum ada pertanyaan tambahan.</p>
                                    <p className="text-sm text-muted-foreground/70 mt-1">Data diri dan pertanyaan spiritualitas otomatis ditambahkan.</p>
                                </div>
                            )}

                            <Button onClick={addField} variant="outline" className="w-full py-8 border-2 border-dashed border-primary text-primary hover:bg-primary/5 hover:text-primary rounded-2xl font-bold text-lg">
                                <Plus className="w-5 h-5 mr-2" /> Tambah Pertanyaan Baru
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
