"use client";

import { useTransition, useState } from "react";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { restoreFormAction } from "@/app/actions/forms";
import { useToast } from "@/hooks/use-toast";
import type { Form } from "@/types/forms";

/**
 * Halaman sampah (trash) — form yang di-soft-delete (Fase 7-6).
 *
 * Semua tombol di sini memanggil server action yang memanggil requireAdmin()
 * (lihat app/actions/forms.ts); otorisasi tidak bergantung pada komponen ini.
 *
 * Kartu hilang seketika setelah restore berhasil (state lokal), tanpa
 * router.refresh() yang me-render ulang seluruh halaman.
 */
export function TrashFormsClient({
  forms,
  counts,
}: {
  forms: Form[];
  counts: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restored, setRestored] = useState<Set<string>>(() => new Set());
  const { toast } = useToast();

  const visibleForms = forms.filter((f) => !restored.has(f.id));

  const handleRestore = (id: string) =>
    startTransition(async () => {
      setRestoringId(id);
      try {
        const res = await restoreFormAction(id);
        toast({
          title: res.success ? "Berhasil" : "Gagal",
          description: res.success
            ? "Form dikembalikan. Muncul lagi di dashboard."
            : res.error,
          variant: res.success ? "default" : "destructive",
        });
        // Hapus kartu dari tampilan (restoreFormAction sudah revalidatePath).
        if (res.success) {
          setRestored((prev) => new Set(prev).add(id));
        }
      } finally {
        setRestoringId(null);
      }
    });

  if (visibleForms.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Trash2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
          Sampah kosong. Form yang Anda hapus (yang memiliki respons) akan
          muncul di sini dan bisa dikembalikan kapan saja.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {visibleForms.map((form) => {
        const isRestoring = restoringId === form.id;
        return (
          <Card key={form.id} className="border-dashed">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="font-medium truncate">
                  {form.title}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    /{form.slug}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {counts[form.id] ?? 0} respons tersimpan · dihapus{" "}
                  {form.deleted_at
                    ? new Date(form.deleted_at).toLocaleString("id-ID")
                    : "-"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-shrink-0"
                disabled={pending}
                onClick={() => handleRestore(form.id)}
              >
                {isRestoring ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                )}
                {isRestoring ? "Mengembalikan…" : "Kembalikan"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
