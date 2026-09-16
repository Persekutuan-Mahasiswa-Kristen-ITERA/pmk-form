import React from "react";
import { notFound } from "next/navigation";
import { getFormById, getAllFormResponses } from "@/lib/forms";
import { GenericResponseTable } from "@/components/GenericResponseTable";

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

  return <GenericResponseTable form={form} responses={responses} />;
}
