import Link from "next/link";
import type { ReactNode } from "react";
import type { FormType } from "@/types/forms";
import { isFormActive } from "@/lib/forms";

/**
 * Komponen UI bersama untuk landing page (Fase 2-5).
 *
 * `StatCard` dan `FilterChip` sebelumnya didefinisikan sebagai function lokal di
 * `app/page.tsx`; komputasi statistik juga diduplikasi di dashboard admin.
 * Ketiganya diekstrak ke sini supaya satu sumber kebenaran.
 */

/**
 * Daftar kategori form untuk filter landing.
 *
 * Nilai `value` adalah `form_type` di DB; label adalah teks yang ditampilkan.
 * Urutan ini juga dipakai di dashboard admin (lihat di bawah).
 */
export const FORM_CATEGORIES: { label: string; value: FormType | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Recruitment", value: "recruitment" },
  { label: "Event", value: "event" },
  { label: "Survei", value: "survey" },
  { label: "Presensi", value: "presensi" },
  { label: "Umum", value: "general" },
];

const STAT_CARD_COLORS: Record<string, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  accent: "bg-amber-100 text-amber-700 border-amber-200",
  destructive: "bg-red-100 text-red-700 border-red-200",
};

export function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  color: keyof typeof STAT_CARD_COLORS | string;
}) {
  const colorClass = STAT_CARD_COLORS[color] ?? STAT_CARD_COLORS.primary;
  return (
    <div
      className={`rounded-2xl p-3 sm:p-4 text-center bg-white shadow-sm border ${colorClass} transition-all hover:shadow-md`}
    >
      <div className="flex items-center justify-center gap-2 mb-1.5">{icon}</div>
      <div className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{value}</div>
      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all shrink-0 border shadow-sm whitespace-nowrap ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
          : "bg-white text-foreground/70 border-border/50 hover:bg-secondary/50 hover:border-accent/30"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Komputasi statistik form yang sebelumnya diduplikasi antara landing page dan
 * dashboard admin (Fase 2-5). Keduanya memakai `isFormActive` dari `lib/forms`
 * sebagai definisi "aktif", jadi angka di kedua halaman selalu konsisten.
 */
export function computeFormStats(
  forms: { is_open: boolean | null; open_date: string | null; close_date: string | null }[]
) {
  const active = forms.filter((f) => isFormActive(f));
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  return {
    total: forms.length,
    activeCount: active.length,
    /** Form aktif yang tutup dalam <= 7 hari. */
    closingSoon: active.filter(
      (f) => f.close_date && new Date(f.close_date).getTime() - now <= WEEK_MS
    ).length,
    /** Form non-aktif: flag is_open mati ATAU sudah lewat close_date. */
    closed: forms.length - active.length,
  };
}
