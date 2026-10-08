"use client";

/**
 * SegmentedControl — pil berbasis sticky-within-track (UI Overhaul U1).
 *
 * Dipakai untuk beralih periode grafik ("6 bulan" / "12 bulan"). Opsi aktif
 * adalah pil putih dengan bayangan halus di atas trek krem; opsi tidak aktif
 * transparan.
 *
 * Client component karena menyimpan state pilihan (interactive control).
 */
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Label yang dibaca pembaca layar untuk grup kontrol ini. */
  "aria-label"?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary/70 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[36px] rounded-full px-3.5 text-xs font-semibold transition-colors sm:text-sm",
              active
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
