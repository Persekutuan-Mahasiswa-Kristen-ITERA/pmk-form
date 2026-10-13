"use client";

import { useState, useCallback } from "react";
import type { Form } from "@/types/forms";

/**
 * State daftar form dengan optimistic update (React 18 — useOptimistic belum
 * tersedia, jadi pakai state biasa).
 *
 * `setOpen`/`remove` mengubah UI seketika. Pemanggil bertanggung jawab rollback
 * bila server action gagal (lihat FormQuickActions: ia memanggil onToggled dua
 * kali — nilai baru, lalu nilai lama bila gagal).
 */
export type FormWithCount = Form & { responseCount: number };

export function useOptimisticForms(initial: FormWithCount[]) {
  const [forms, setForms] = useState<FormWithCount[]>(initial);

  const setOpen = useCallback((id: string, isOpen: boolean) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_open: isOpen } : f))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setForms((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { forms, setOpen, remove };
}
