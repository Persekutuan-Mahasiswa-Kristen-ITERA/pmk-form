import React from "react";
import { notFound } from "next/navigation";
import { getFormById, getAllFormResponses, resolveFormFields } from "@/lib/forms";
import dynamic from "next/dynamic";
import { ResponsesTableSkeleton } from "@/components/skeleton";

// Code-splitting: GenericResponseTable menarik JSZip + Papa.parse (~100KB+)
// yang hanya dipakai untuk tombol export. Dimuat on-demand dengan skeleton
// agar halaman admin lain (dashboard, daftar form) tetap ringan & cepat.
const GenericResponseTable = dynamic(
  () => import("@/components/GenericResponseTable").then((m) => m.GenericResponseTable),
  { ssr: true, loading: () => <ResponsesTableSkeleton /> },
);

export const revalidate = 0; // Dynamic data

export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await getFormById(id);

  if (!form) {
    notFound();
  }

  const responses = await getAllFormResponses(id);

  // Tampilkan field yang sama dengan yang diisi pendaftar, termasuk identitas
  // otomatis (Nama/NIM/Email/Angkatan) — juga untuk CSV dan nama folder ZIP.
  const resolvedForm = { ...form, form_fields: resolveFormFields(form) };

  return <GenericResponseTable form={resolvedForm} responses={responses} />;
}
