"use client";

import { useState, useTransition, useEffect } from "react";
import { Sheet, Loader2, RefreshCw, UploadCloud, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  saveSheetsConfigAction,
  testSheetsConnectionAction,
  getSheetsStatusAction,
  retryFailedSyncAction,
  backfillSyncAction,
} from "@/app/actions/sheetsConfig";

/**
 * Panel pengaturan Google Sheets per form (Fase 6-4).
 *
 * Server action yang dipanggil memakai requireAdmin() (otorisasi di server).
 * Email service account dimuat dari env server; TIDAK ada secret di sini.
 */
export function SheetsSettingsPanel({
  formId,
  initialConfig,
  serviceAccountEmail,
}: {
  formId: string;
  initialConfig: { spreadsheet_id?: string; sheet_name?: string; enabled?: boolean } | null;
  serviceAccountEmail: string | null;
}) {
  const [spreadsheetId, setSpreadsheetId] = useState(initialConfig?.spreadsheet_id ?? "");
  const [sheetName, setSheetName] = useState(initialConfig?.sheet_name ?? "Sheet1");
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? false);
  const [status, setStatus] = useState<{
    pending: number;
    failed: number;
    synced: number;
    lastSyncedAt: string | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  // Ambil status sinkronisasi saat mount (hanya bila sudah aktif).
  useEffect(() => {
    if (!initialConfig?.enabled) return;
    void getSheetsStatusAction(formId).then((res) => {
      if (res.success) setStatus(res.status);
    });
  }, [formId, initialConfig?.enabled]);

  const handleSave = () =>
    startTransition(async () => {
      const res = await saveSheetsConfigAction(formId, {
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        enabled,
      });
      toast({
        title: res.success ? "Berhasil" : "Gagal",
        description: res.success
          ? enabled
            ? "Integrasi Sheets diaktifkan."
            : "Konfigurasi disimpan (integrasi nonaktif)."
          : res.error,
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) {
        const st = await getSheetsStatusAction(formId);
        if (st.success) setStatus(st.status);
      }
    });

  const handleTest = () =>
    startTransition(async () => {
      // Simpan dulu supaya tes memakai config terbaru.
      await saveSheetsConfigAction(formId, {
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        enabled,
      });
      const res = await testSheetsConnectionAction(formId);
      toast({
        title: res.success ? "Koneksi OK" : "Koneksi gagal",
        description: res.message ?? res.error,
        variant: res.success ? "default" : "destructive",
      });
    });

  const handleRetry = () =>
    startTransition(async () => {
      const res = await retryFailedSyncAction(formId);
      toast({
        title: res.success ? "Berhasil" : "Gagal",
        description: res.success
          ? `${res.count} baris dijadwalkan ulang.`
          : res.error,
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) {
        const st = await getSheetsStatusAction(formId);
        if (st.success) setStatus(st.status);
      }
    });

  const handleBackfill = () => {
    if (
      !confirm(
        "Sinkronkan SEMUA respons form ini ke spreadsheet? Data lama (~240 baris) akan dikirim dalam batch. Proses ini idempoten — aman dijalankan ulang."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await backfillSyncAction(formId);
      toast({
        title: res.success ? "Backfill dijadwalkan" : "Gagal",
        description: res.success
          ? `${res.count} respons dimasukkan ke antrian. Sinkronisasi diproses di latar belakang.`
          : res.error,
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) {
        const st = await getSheetsStatusAction(formId);
        if (st.success) setStatus(st.status);
      }
    });
  };

  return (
    <Card className="border-accent/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sheet className="w-5 h-5" /> Integrasi Google Sheets
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Mirror satu arah ke spreadsheet. <strong>form_responses</strong> tetap sumber kebenaran;
          kegagalan Sheets tidak menggagalkan submit pendaftar.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Peringatan PII */}
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Spreadsheet berisi data pribadi (NIM, nama, email). Batasi akses spreadsheet hanya untuk
            pengurus yang berwenang.
          </p>
        </div>

        {/* Service account email untuk di-share */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Email service account (bagikan spreadsheet ke email ini sebagai Editor)</Label>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted/40 px-3 py-2 rounded-lg flex-1 break-all">
              {serviceAccountEmail ?? "BELUM DIKONFIGURASI (set GOOGLE_SERVICE_ACCOUNT_EMAIL di env)"}
            </code>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sheets-url" className="text-sm font-semibold">
            URL atau ID Spreadsheet
          </Label>
          <Input
            id="sheets-url"
            placeholder="https://docs.google.com/spreadsheets/d/1AbC123/edit"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Bisa tempel URL lengkap; ID diekstrak otomatis.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sheet-name" className="text-sm font-semibold">
            Nama Sheet (tab)
          </Label>
          <Input
            id="sheet-name"
            placeholder="Sheet1"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            className="rounded-xl"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 rounded accent-primary"
          />
          <span className="text-sm font-medium">Aktifkan sinkronisasi otomatis</span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={pending} className="rounded-xl">
            {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Simpan
          </Button>
          <Button onClick={handleTest} disabled={pending} variant="outline" className="rounded-xl">
            Tes Koneksi
          </Button>
          {enabled && (
            <>
              <Button onClick={handleRetry} disabled={pending} variant="outline" className="rounded-xl">
                <RefreshCw className="w-4 h-4 mr-2" /> Coba Ulang yang Gagal
              </Button>
              <Button onClick={handleBackfill} disabled={pending} variant="outline" className="rounded-xl">
                <UploadCloud className="w-4 h-4 mr-2" /> Sinkronkan Semua Respons
              </Button>
            </>
          )}
        </div>

        {/* Status sinkronisasi */}
        {status && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <Badge variant="secondary" className="text-[10px]">Tersinkron: {status.synced}</Badge>
            <Badge variant="outline" className="text-[10px]">Antri: {status.pending}</Badge>
            {status.failed > 0 && (
              <Badge variant="destructive" className="text-[10px]">Gagal: {status.failed}</Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Sinkron terakhir:{" "}
              {status.lastSyncedAt
                ? new Date(status.lastSyncedAt).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "belum pernah"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
