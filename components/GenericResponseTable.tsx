"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, FileText, Trash2, Eye, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import JSZip from "jszip";
import saveAs from "file-saver";
import { deleteFormResponseAction } from "@/app/actions/deleteResponse";
import type { Form, FormResponse, FieldConfig, FieldValue } from "@/types/forms";

/**
 * Resolve a field's answer from a response.
 *
 * New submissions are keyed by the stable `field.id`. Responses migrated from
 * the legacy `submissions` table are keyed by the field's human-readable
 * `label` instead. Prefer the id and fall back to the label so both shapes
 * render without rewriting production data.
 */
function resolveAnswer(res: FormResponse, field: FieldConfig): FieldValue {
  const answers = res.answers ?? {};
  const value = field.id in answers ? answers[field.id] : answers[field.label];
  return (value as FieldValue) ?? null;
}

export function GenericResponseTable({
  form,
  responses: initialResponses,
}: {
  form: Form;
  responses: FormResponse[];
}) {
  const [responses, setResponses] = useState<FormResponse[]>(initialResponses);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const { toast } = useToast();

  const fields = form.form_fields || [];

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus respons ini?")) return;
    try {
      await deleteFormResponseAction(id, form.id);
      setResponses((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Berhasil", description: "Respons berhasil dihapus." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus respons";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleExportCsv = () => {
    setIsExportingCsv(true);
    try {
      const rows = responses.map((res, index) => {
        const rowData: Record<string, unknown> = {
          No: index + 1,
          "Waktu Submit": new Date(res.submitted_at).toLocaleString("id-ID"),
        };

        fields.forEach((f) => {
          const val = resolveAnswer(res, f);
          rowData[f.label] = Array.isArray(val) ? val.join(", ") : val || "";
        });

        if (res.files && res.files.length > 0) {
          rowData["Lampiran"] = res.files.join(" ; ");
        }

        return rowData;
      });

      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `Respons - ${form.slug} - ${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: "Berhasil", description: "File CSV berhasil diunduh." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal export CSV";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportZip = async () => {
    const responsesWithFiles = responses.filter((r) => r.files && r.files.length > 0);
    if (responsesWithFiles.length === 0) {
      toast({ title: "Info", description: "Tidak ada lampiran file pada respons ini." });
      return;
    }

    setIsExportingZip(true);
    setZipProgress(0);

    try {
      const zip = new JSZip();
      const folderName = `Lampiran - ${form.slug}`;
      const folder = zip.folder(folderName);

      if (!folder) throw new Error("Gagal membuat folder ZIP");

      let downloadedCount = 0;
      const totalFiles = responsesWithFiles.reduce((acc, r) => acc + r.files.length, 0);

      for (const res of responsesWithFiles) {
        // Coba cari nama responden untuk folder lampiran
        let respondentName = "Responden_" + res.id.slice(0, 6);
        for (const f of fields) {
          if (f.label.toLowerCase().includes("nama") && resolveAnswer(res, f)) {
            respondentName = String(resolveAnswer(res, f)).replace(/[^a-zA-Z0-9]/g, "_");
            break;
          }
        }

        const subFolder = folder.folder(respondentName);
        if (!subFolder) continue;

        for (const fileUrl of res.files) {
          try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const fileName = fileUrl.split("/").pop()?.split("?")[0] || "lampiran.pdf";
            subFolder.file(fileName, blob);
          } catch (e) {
            console.error("Gagal mendownload file:", fileUrl, e);
          }
          downloadedCount++;
          setZipProgress(Math.round((downloadedCount / totalFiles) * 100));
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Lampiran - ${form.slug}.zip`);
      toast({ title: "Berhasil", description: "Semua lampiran berhasil diunduh sebagai ZIP." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal export ZIP";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsExportingZip(false);
      setZipProgress(0);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/forms">
              <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Respons: {form.title}</h1>
            <p className="text-xs text-muted-foreground">Total Respons Masuk: {responses.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExportingCsv || responses.length === 0}>
            {isExportingCsv ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            Export CSV
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportZip} disabled={isExportingZip || responses.length === 0}>
            {isExportingZip ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            {isExportingZip ? `Downloading (${zipProgress}%)...` : "Export Lampiran (ZIP)"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Daftar Respons Pengisi</CardTitle>
          <CardDescription className="text-xs">Klik ikon mata untuk melihat detail lengkap jawaban</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {responses.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Belum ada respons yang masuk untuk form ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Waktu Submit</TableHead>
                    {fields.slice(0, 3).map((f) => (
                      <TableHead key={f.id}>{f.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((res, idx) => {
                    return (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(res.submitted_at).toLocaleString("id-ID")}
                        </TableCell>
                        {fields.slice(0, 3).map((f) => {
                          const val = resolveAnswer(res, f);
                          const displayVal = Array.isArray(val) ? val.join(", ") : String(val || "-");
                          return (
                            <TableCell key={f.id} className="max-w-[200px] truncate">
                              {displayVal}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedResponse(res)}
                            title="Detail"
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(res.id)}
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedResponse} onOpenChange={(open) => !open && setSelectedResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Respons</DialogTitle>
            <DialogDescription>
              Disubmit pada: {selectedResponse && new Date(selectedResponse.submitted_at).toLocaleString("id-ID")}
            </DialogDescription>
          </DialogHeader>

          {selectedResponse && (
            <div className="space-y-4 pt-2">
              <div className="border rounded-xl p-4 space-y-3 bg-secondary/20">
                {fields.map((f) => {
                  const val = resolveAnswer(selectedResponse, f);
                  const displayVal = Array.isArray(val) ? val.join(", ") : val || "-";
                  return (
                    <div key={f.id} className="text-sm">
                      <span className="font-semibold text-muted-foreground block text-xs">{f.label}</span>
                      <span className="text-foreground font-medium">{String(displayVal)}</span>
                    </div>
                  );
                })}
              </div>

              {selectedResponse.files && selectedResponse.files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lampiran File</h4>
                  <div className="flex flex-col gap-2">
                    {selectedResponse.files.map((fileUrl, i) => (
                      <a
                        key={i}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline truncate block bg-primary/5 p-2 rounded-lg border border-primary/20 hover:bg-primary/10"
                      >
                        {fileUrl}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
