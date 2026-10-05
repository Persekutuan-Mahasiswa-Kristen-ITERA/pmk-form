import React from "react";
import { getAuditLog, type AuditEntry } from "@/lib/audit";
import { getAdminUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, ScrollText } from "lucide-react";

/**
 * Halaman viewer audit log (Fase 7 item 5).
 *
 * Server Component, SUPER_ADMIN only. Sumber: public.admin_audit_log
 * (append-only; baca lewat getAuditLog yang cek getAdminUser).
 *
 * !!! Data sensitif: actor_email + target_email + detail bisa mengandung
 *     info pribadi (mis. email responden). Karena itu halaman ini hanya
 *     untuk super_admin, BUKAN admin divisi.
 */
export const revalidate = 0;

// Label ramah untuk setiap aksi.
const ACTION_LABELS: Record<string, string> = {
  invite: "Undang admin",
  reinvite: "Kirim ulang undangan",
  update_role: "Ubah role admin",
  activate: "Aktifkan admin",
  disable: "Nonaktifkan admin",
  delete: "Hapus admin",
  self_link: "Tautkan akun",
  form_create: "Buat form",
  form_update: "Edit form",
  form_delete: "Hapus form",
  form_duplicate: "Duplikasi form",
  form_toggle: "Buka/tutup form",
  response_delete: "Hapus respons",
  response_status_update: "Ubah status respons",
  sheets_config_save: "Simpan konfigurasi Sheets",
};

export default async function AuditLogPage() {
  const admin = await getAdminUser();

  if (!admin || admin.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-t-8 border-t-destructive shadow-xl bg-white rounded-3xl">
          <CardContent className="space-y-6 text-center pt-10 pb-10">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-bold">Akses Ditolak</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Audit log hanya untuk super admin.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  let entries: AuditEntry[] = [];
  let loadError: string | null = null;
  try {
    entries = await getAuditLog(200);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat audit log.";
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="flex items-center gap-3 border-b pb-4">
        <ScrollText className="w-7 h-7 text-primary" />
        <div>
          <h1 className="font-serif text-2xl font-bold">Audit Log</h1>
          <p className="text-xs text-muted-foreground">
            Jejak semua aksi admin penting. Append-only — tidak bisa diubah atau dihapus.
          </p>
        </div>
      </div>

      {loadError ? (
        <Card className="bg-destructive/5 border-destructive/30">
          <CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            Belum ada aksi yang tercatat.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4 font-semibold">Waktu</th>
                <th className="py-3 pr-4 font-semibold">Aksi</th>
                <th className="py-3 pr-4 font-semibold">Oleh</th>
                <th className="py-3 pr-4 font-semibold">Target</th>
                <th className="py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0 align-top">
                  <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-block rounded-lg bg-primary/5 border border-primary/20 px-2 py-1 text-xs font-medium">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs">{entry.actor_email ?? "-"}</td>
                  <td className="py-3 pr-4 text-xs">{entry.target_email ?? "-"}</td>
                  <td className="py-3 text-xs font-mono text-muted-foreground break-all">
                    {Object.keys(entry.detail ?? {}).length > 0
                      ? JSON.stringify(entry.detail)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
