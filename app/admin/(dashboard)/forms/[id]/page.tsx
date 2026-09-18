import React from "react";
import { notFound } from "next/navigation";
import { GenericFormBuilder } from "@/components/GenericFormBuilder";
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

  return <GenericFormBuilder initialData={form} />;
}
