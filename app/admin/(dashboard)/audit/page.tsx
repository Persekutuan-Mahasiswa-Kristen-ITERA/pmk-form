import React from "react";
import { getAuditLog, type AuditEntry } from "@/lib/audit";
import { getAdminUser } from "@/lib/auth";
import { AccessDeniedCard } from "@/components/access-denied";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { ResponsiveTable } from "@/components/responsive-table";

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
      <AccessDeniedCard message="Audit log hanya untuk super admin." />
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
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Jejak semua aksi admin penting. Append-only — tidak bisa diubah atau dihapus."
      />

      {loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {loadError}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="Belum ada aksi yang tercatat"
          description="Aktivitas admin (buat/edit form, undang admin, hapus respons) akan muncul di sini."
        />
      ) : (
        <SectionCard title={`${entries.length} entri terbaru`}>
          <ResponsiveTable
            caption="Audit log"
            columns={[
              { header: "Waktu" },
              { header: "Aksi" },
              { header: "Oleh" },
              { header: "Target" },
              { header: "Detail" },
            ]}
            rows={entries.map((entry) => [
              <span
                key="waktu"
                className="whitespace-nowrap text-xs text-muted-foreground"
              >
                {new Date(entry.created_at).toLocaleString("id-ID")}
              </span>,
              <span
                key="aksi"
                className="inline-block rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium"
              >
                {ACTION_LABELS[entry.action] ?? entry.action}
              </span>,
              <span key="oleh" className="text-xs">
                {entry.actor_email ?? "-"}
              </span>,
              <span key="target" className="text-xs">
                {entry.target_email ?? "-"}
              </span>,
              <span
                key="detail"
                className="break-all font-mono text-xs text-muted-foreground"
              >
                {Object.keys(entry.detail ?? {}).length > 0
                  ? JSON.stringify(entry.detail)
                  : "-"}
              </span>,
            ])}
          />
        </SectionCard>
      )}
    </div>
  );
}
