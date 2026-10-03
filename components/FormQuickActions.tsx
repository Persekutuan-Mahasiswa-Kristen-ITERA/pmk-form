"use client";

import { useState, useTransition } from "react";
import { Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFormOpenAction, deleteFormAction } from "@/app/actions/forms";
import { useToast } from "@/hooks/use-toast";

/**
 * Aksi cepat kartu admin (Fase 4C).
 *
 * - Toggle buka/tutup 1-klik (tanpa buka halaman edit).
 * - Hapus form dengan konfirmasi ganda; server MENOLAK bila form punya
 *   respons (lihat deleteForm di lib/forms.ts) — tombol dikunci untuk form
 *   berisi respons agar admin tidak salah pencet.
 */
export function FormQuickActions({
  formId,
  isOpen,
  responseCount,
}: {
  formId: string;
  isOpen: boolean;
  responseCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();
  const hasResponses = responseCount > 0;

  const handleToggle = () =>
    startTransition(async () => {
      const res = await toggleFormOpenAction(formId, !isOpen);
      toast({
        title: res.success ? "Berhasil" : "Gagal",
        description: res.success
          ? isOpen
            ? "Form ditutup. Tidak lagi tampil di landing."
            : "Form dibuka. Kembali tampil di landing."
          : res.error,
        variant: res.success ? "default" : "destructive",
      });
    });

  const handleDelete = () =>
    startTransition(async () => {
      if (!confirming) {
        setConfirming(true);
        return;
      }
      setConfirming(false);
      const res = await deleteFormAction(formId);
      toast({
        title: res.success ? "Berhasil" : "Gagal",
        description: res.success ? "Form dihapus." : res.error,
        variant: res.success ? "default" : "destructive",
      });
    });

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        disabled={pending}
        onClick={handleToggle}
        title={isOpen ? "Tutup form" : "Buka form"}
      >
        {isOpen ? "Tutup" : "Buka"}
      </Button>

      {hasResponses ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          disabled
          title={`Form memiliki ${responseCount} respons — tidak dapat dihapus. Tutup form sebagai gantinya.`}
        >
          <Lock className="w-3.5 h-3.5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${confirming ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
          disabled={pending}
          onClick={handleDelete}
          title={confirming ? "Klik sekali lagi untuk konfirmasi hapus" : "Hapus form (kosong, tanpa respons)"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
