/**
 * StatusBadge & CategoryBadge — badge pil dengan teks wajib (UI Overhaul U1).
 *
 * Aturan (referensi 3.G): status TIDAK boleh hanya berbasis warna — teks
 * wajib ada. Karena itu `StatusBadge` selalu merender label dari
 * `getFormStatus()`, ditambah titik kecil di depan.
 *
 * Warna kategori dipetakan dari `lib/form-status.ts` (sumber aslinya
 * `components/FormCard.tsx` `badgeColors`) — tidak diciptakan ulang.
 */
import { cn } from "@/lib/utils";
import {
  getFormStatus,
  FORM_STATUS_STYLES,
  CATEGORY_STYLES,
  CATEGORY_DEFAULT,
} from "@/lib/form-status";

export interface StatusBadgeProps {
  form: {
    is_open: boolean | null;
    open_date: string | null;
    close_date: string | null;
  };
  className?: string;
}

export function StatusBadge({ form, className }: StatusBadgeProps) {
  const status = getFormStatus(form);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
        FORM_STATUS_STYLES[status.kind],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {status.label}
    </span>
  );
}

export interface CategoryBadgeProps {
  /** Nilai `form_type` dari DB. */
  value: string;
  className?: string;
}

export function CategoryBadge({ value, className }: CategoryBadgeProps) {
  const cat =
    CATEGORY_STYLES[value] ?? {
      ...CATEGORY_DEFAULT,
      label: value,
    };
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        cat.className,
        className,
      )}
    >
      {cat.label}
    </span>
  );
}
