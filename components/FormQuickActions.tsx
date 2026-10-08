"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, Copy } from "lucide-react";
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
 * - Hapus form dengan konfirmasi ganda. Form berisi respons di-SOFT DELETE
 *   (Fase 7-6): disembunyikan dari dashboard, data tetap aman; bisa
 *   dikembalikan dari halaman sampah. Form kosong di-hard delete.
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
        description: res.success
          ? res.softDeleted
            ? "Form disembunyikan (soft delete). Data tetap aman; bisa dikembalikan dari sampah."
            : "Form dihapus permanen."
          : res.error,
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) router.refresh();
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
        className="min-h-[44px] text-xs"
        disabled={pending}
        onClick={handleToggle}
        title={isOpen ? "Tutup form" : "Buka form"}
      >
        {isOpen ? "Tutup" : "Buka"}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-primary"
        asChild
        aria-label="Edit form"
        title="Edit form"
      >
        <Link href={`/admin/forms/${formId}`}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-primary"
        disabled={pending}
        onClick={handleDuplicate}
        aria-label="Duplikasi form (salinan dibuat dalam keadaan ditutup)"
        title="Duplikasi form (salinan dibuat dalam keadaan ditutup)"
      >
        <Copy className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={`min-h-[44px] min-w-[44px] ${confirming ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
        disabled={pending}
        onClick={handleDelete}
        aria-label={confirming ? "Klik sekali lagi untuk konfirmasi hapus" : "Hapus form"}
        title={
          confirming
            ? "Klik sekali lagi untuk konfirmasi hapus"
            : hasResponses
              ? `Hapus form (soft delete — ${responseCount} respons tetap tersimpan, bisa dikembalikan dari sampah)`
              : "Hapus form (kosong, tanpa respons)"
        }
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
