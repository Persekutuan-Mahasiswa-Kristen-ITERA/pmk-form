import React from "react";
import { notFound } from "next/navigation";
import { GenericFormBuilder } from "@/components/GenericFormBuilder";
import { SheetsSettingsPanel } from "@/components/SheetsSettingsPanel";
import { getFormById } from "@/lib/forms";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await getFormById(id);

  if (!form) {
    notFound();
  }

  // Email service account dibaca dari env SERVER (bukan secret, hanya email
  // publik yang harus di-share spreadsheet-nya — aman ditampilkan ke admin).
  // Private key TIDAK PERNAH dikirim ke client.
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;

  return (
    <div className="space-y-8">
      <GenericFormBuilder initialData={form} />
      <SheetsSettingsPanel
        formId={form.id}
        initialConfig={form.sheets_config ?? null}
        serviceAccountEmail={serviceAccountEmail}
      />
    </div>
  );
}
