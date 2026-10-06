"use client";

/**
 * ConfirmDialog — dialog konfirmasi bermerek untuk aksi destruktif
 * (UI Overhaul U1).
 *
 * Mengganti `window.confirm()` native yang tidak ramah mobile, tidak bisa
 * di-styling, dan memblokir UI. Dipakai untuk hapus respons, hapus admin,
 * dll — aksi destruktif selalu didahului konfirmasi eksplisit (batasan 6).
 *
 * Otorisasi TIDAK ada di sini — tetap di server action (`requireAdmin()`),
 * dialog ini hanya pengaman UI.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Judul dialog (serif). */
  title: string;
  /** Deskripsi konsekuensi aksi. */
  description: ReactNode;
  /** Teks tombol konfirmasi (mis. "Hapus"). */
  confirmLabel?: string;
  /** Teks tombol batal. */
  cancelLabel?: string;
  /** Gaya destruktif (merah halus) untuk aksi menghapus. */
  destructive?: boolean;
  /** Sedang memproses (menonaktifkan tombol + spinner). */
  pending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-bold">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
