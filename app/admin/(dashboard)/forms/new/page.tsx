import React from "react";
import dynamic from "next/dynamic";
import { FormBuilderSkeleton } from "@/components/skeleton";

// Code-splitting: GenericFormBuilder menarik @dnd-kit (core+sortable+utilities,
// ~60KB+) + react-hook-form. Hanya dipakai di halaman buat/edit form —
// halaman admin lain tetap ringan.
const GenericFormBuilder = dynamic(
  () => import("@/components/GenericFormBuilder").then((m) => m.GenericFormBuilder),
  { loading: () => <FormBuilderSkeleton /> },
);

export default function NewFormPage() {
  return <GenericFormBuilder />;
}
