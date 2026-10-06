/**
 * ResponsiveTable — tabel di desktop, daftar kartu di mobile (UI Overhaul U1).
 *
 * Pola referensi (bagian 4): di bawah `md`, setiap baris tabel menjadi satu
 * kartu. Pemanggil menyediakan satu set kolom (`columns`) + data (`rows`);
 * kolom bisa disembunyikan di mobile (`hideOnMobile`) atau diperlakukan sebagai
 * slot aksi kanan (`align: "right"`).
 *
 * Server Component — tidak ada state/interaktivitas. Tombol aksi di dalam
 * `rows` bisa berupa client component (komposisi React).
 *
 * Aksesibilitas: tabel desktop memakai `<caption>` (disembunyikan visual,
 * dibaca pembaca layar) dan `scope="col"` di header.
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface TableColumn {
  /** Header tabel (kapital kecil, cokelat). */
  header: string;
  /**
   * Class lebar/penempatan kolom desktop, mis. "w-[120px] text-right".
   * Kolom teks rata kiri; kolom aksi rata kanan (referensi 3.G).
   */
  className?: string;
  /** Sembunyikan kolom ini di tampilan kartu mobile. */
  hideOnMobile?: boolean;
}

export interface ResponsiveTableProps {
  /** Caption untuk pembaca layar (disembunyikan visual). */
  caption?: string;
  columns: TableColumn[];
  rows: ReactNode[][];
  className?: string;
}

export function ResponsiveTable({
  caption,
  columns,
  rows,
  className,
}: ResponsiveTableProps) {
  if (rows.length === 0) return null;

  return (
    <>
      {/* Desktop: tabel */}
      <div className="hidden overflow-x-auto md:block">
        <table className={cn("w-full border-collapse text-left", className)}>
          {caption ? (
            <caption className="sr-only">{caption}</caption>
          ) : null}
          <thead>
            <tr className="border-b border-border bg-background/60">
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-accent",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, ri) => (
              <tr
                key={ri}
                className="group border-b border-border/50 transition-colors last:border-0 hover:bg-background/40"
              >
                {cells.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "px-4 py-3 align-middle text-sm text-foreground",
                      columns[ci]?.className,
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: daftar kartu */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((cells, ri) => (
          <div
            key={ri}
            className="rounded-2xl border border-border bg-white p-4 shadow-sm"
          >
            {cells.map((cell, ci) => {
              const col = columns[ci];
              if (col?.hideOnMobile) return null;
              return (
                <div key={ci} className="flex items-center gap-3 py-1.5">
                  <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {col?.header}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    {cell}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
