"use client";

import { useState, useTransition } from "react";
import { Lock, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  toggleFormOpenAction,
  deleteFormAction,
  duplicateFormAction,
} from "@/app/actions/forms";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
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

  const handleDuplicate = () =>
    startTransition(async () => {
      const res = await duplicateFormAction(formId);
      if (!res.success) {
        toast({
          title: "Gagal",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Form diduplikasi",
        description: "Salinan dibuat dalam keadaan ditutup. Periksa dulu sebelum dibuka.",
      });
      // Bawa admin langsung ke editor form baru untuk diperiksa.
      router.push(`/admin/forms/${res.data.id}`);
      router.refresh();
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

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-primary"
        disabled={pending}
        onClick={handleDuplicate}
        title="Duplikasi form (salinan dibuat dalam keadaan ditutup)"
      >
        <Copy className="w-3.5 h-3.5" />
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
