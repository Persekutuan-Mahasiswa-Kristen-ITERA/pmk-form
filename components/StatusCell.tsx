"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { updateResponseStatusAction } from "@/app/actions/responseStatus";
import { useToast } from "@/hooks/use-toast";
import type { FormResponse, ResponseStatus } from "@/types/forms";
import { RESPONSE_STATUS_LABELS } from "@/types/forms";

/**
 * Sel dropdown status respons di tabel admin (Fase 7-3).
 *
 * !!! Autorisasi: server action memanggil requireAdmin() — client tidak
 * bisa memalsukan status pengguna lain. RLS policy (migration 011) jadi
 * pertahanan kedua.
 *
 * Daftar pilihan: semua status + "Belum diproses" (nilai NULL).
 */

const STATUS_OPTIONS: { value: ResponseStatus | "none"; label: string }[] = [
  { value: "none", label: "Belum diproses" },
  { value: "diterima", label: RESPONSE_STATUS_LABELS.diterima },
  { value: "tidak_lolos", label: RESPONSE_STATUS_LABELS.tidak_lolos },
  { value: "cadangan", label: RESPONSE_STATUS_LABELS.cadangan },
];

const BADGE_CLASS: Record<string, string> = {
  diterima: "bg-green-100 text-green-800 border-green-300",
  tidak_lolos: "bg-red-100 text-red-800 border-red-300",
  cadangan: "bg-amber-100 text-amber-800 border-amber-300",
};

export function StatusCell({
  res,
  formId,
  onUpdated,
}: {
  res: FormResponse;
  formId: string;
  onUpdated: (status: ResponseStatus | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const current = res.status ?? "none";
  const currentLabel =
    current === "none"
      ? "Belum diproses"
      : RESPONSE_STATUS_LABELS[current as ResponseStatus];

  const handleChange = (value: string) => {
    const next = value === "none" ? null : (value as ResponseStatus);
    startTransition(async () => {
      const result = await updateResponseStatusAction({
        responseId: res.id,
        formId,
        status: next,
      });
      if (!result.success) {
        toast({ title: "Gagal", description: result.error, variant: "destructive" });
        return;
      }
      onUpdated(next);
      toast({
        title: "Status diperbarui",
        description: next ? RESPONSE_STATUS_LABELS[next] : "Belum diproses",
      });
    });
  };

  return (
    <TableCell>
      <div className="flex items-center gap-1.5">
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        ) : null}
        <Select value={current} onValueChange={handleChange} disabled={pending}>
          <SelectTrigger
            className={`h-8 text-xs rounded-lg border ${BADGE_CLASS[current] ?? ""}`}
          >
            <SelectValue>{currentLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </TableCell>
  );
}
