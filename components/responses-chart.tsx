"use client";

/**
 * ResponsesChart — grafik "Respons per periode" (UI Overhaul U2, prompt 3.E).
 *
 * Dibangun dengan SVG murni (tidak ada dependency baru; proyek tidak punya
 * library chart dan prompt melarang menambahnya).
 *
 * Isi: batang = jumlah respons per bulan (`chart-1` koral), garis + titik =
 * jumlah form dibuka per bulan (`chart-2` teal). Bulan mengikuti zona WIB
 * (label sudah dihitung di server via `lib/format.ts`).
 *
 * Aksesibilitas (wajib sesuai 3.E):
 * - `<title>` + `<desc>` di SVG,
 * - tabel tersembunyi (`sr-only`) berisi data mentah untuk pembaca layar,
 * - tooltip muncul saat hover (desktop) dan tap (mobile).
 *
 * Empty state: bila `total === 0`, tampilkan pesan "Belum ada respons pada
 * periode ini" (bukan grafik kosong — itulah cacat referensi yang diperbaiki).
 */
import { useId, useState } from "react";
import type { MonthBucket } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ResponsesChartProps {
  buckets: MonthBucket[];
  /** Jumlah respons per kunci bulan. */
  responseCounts: Record<string, number>;
  /** Jumlah form dibuka per kunci bulan. */
  formOpenedCounts: Record<string, number>;
  total: number;
  /** Tinggi area plot (px). Desktop ~250, mobile ~200 (prompt 4). */
  height?: number;
}

export function ResponsesChart({
  buckets,
  responseCounts,
  formOpenedCounts,
  total,
  height = 250,
}: ResponsesChartProps) {
  const titleId = useId();
  const descId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  // Empty state (prompt 3.E): data kosong → pesan jelas, bukan grafik kosong.
  if (total === 0 || buckets.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/40 text-center">
        <p className="font-serif text-lg font-semibold text-foreground">
          Belum ada respons pada periode ini
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Grafik akan terisi setelah ada pengunjung yang mengirimkan respons ke
          formulirmu.
        </p>
      </div>
    );
  }

  const values = buckets.map((b) => responseCounts[b.key] ?? 0);
  const openedValues = buckets.map((b) => formOpenedCounts[b.key] ?? 0);
  const maxValue = Math.max(1, ...values, ...openedValues);

  // Geometry — mobile-first, lebar 100% via viewBox.
  const W = 100;
  const H = height;
  const padX = 6;
  const padTop = 14;
  const padBottom = 26; // label bulan
  const plotH = H - padTop - padBottom;
  const slotW = (W - padX * 2) / buckets.length;
  const barW = Math.min(5.5, slotW * 0.5);

  // Skala: nilai -> koordinat Y (dipetakan ke plotH).
  const y = (v: number) => padTop + plotH - (v / maxValue) * plotH;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        // preserveAspectRatio none + width 100% supaya grafik mengisi kartu
        // tanpa scroll horizontal di layar sempit.
        className="h-auto w-full touch-manipulation"
        style={{ maxWidth: "100%" }}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>Grafik respons per bulan</title>
        <desc id={descId}>
          {`Total ${total} respons dalam ${buckets.length} bulan terakhir. ` +
            buckets
              .map(
                (b) =>
                  `${b.labelLong}: ${responseCounts[b.key] ?? 0} respons, ${
                    openedValues[buckets.indexOf(b)]
                  } form dibuka`,
              )
              .join(". ")}
        </desc>

        {/* Garis bantu horizontal (maksimum + tengah) — dekoratif */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padTop + plotH - f * plotH}
            y2={padTop + plotH - f * plotH}
            stroke="hsl(var(--border))"
            strokeWidth={0.35}
            strokeDasharray={f === 0 ? undefined : "1.5 1.5"}
          />
        ))}

        {/* Batang respons */}
        {values.map((v, i) => {
          const x = padX + slotW * i + slotW / 2;
          const bh = Math.max(0.6, (v / maxValue) * plotH);
          return (
            <g
              key={buckets[i].key}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => setHovered(hovered === i ? null : i)}
              tabIndex={0}
              role="button"
              aria-label={`${buckets[i].labelLong}: ${v} respons, ${openedValues[i]} form dibuka`}
              className="focus:outline-none"
            >
              {/* Area ketuk lelas (lebih besar dari batang) */}
              <rect
                x={padX + slotW * i}
                y={padTop}
                width={slotW}
                height={plotH}
                fill="transparent"
              />
              {v > 0 ? (
                <rect
                  x={x - barW / 2}
                  y={y(v)}
                  width={barW}
                  height={bh}
                  rx={1.2}
                  className={cn(
                    "transition-opacity",
                    hovered === null || hovered === i
                      ? "fill-[hsl(var(--chart-1))]"
                      : "fill-[hsl(var(--chart-1))] opacity-40",
                  )}
                />
              ) : null}
              {/* Label bulan di sumbu X — dijarangkan di layar kecil */}
              {(buckets.length <= 6 || i % 2 === 0) && (
                <text
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: "3.2px" }}
                >
                  {buckets[i].label}
                </text>
              )}
            </g>
          );
        })}

        {/* Garis form dibuka — DIHAPUS (U6): grafik fokus satu tipe (batang)
            sesuai permintaan; data form dibuka tetap ada di tabel a11y di
            bawah dan deskripsi SVG. */}

        {/* Tooltip hover/tap */}
        {hovered !== null ? (
          <g pointerEvents="none">
            {(() => {
              const i = hovered;
              const x = padX + slotW * i + slotW / 2;
              const tipW = 26;
              const tipH = 12;
              // Jaga tooltip tetap di dalam kanvas.
              const tx = Math.min(
                Math.max(x - tipW / 2, padX),
                W - padX - tipW,
              );
              const ty = Math.max(y(values[i]) - tipH - 3, padTop);
              return (
                <>
                  <rect
                    x={tx}
                    y={ty}
                    width={tipW}
                    height={tipH}
                    rx={1.5}
                    className="fill-foreground"
                    opacity={0.92}
                  />
                  <text
                    x={tx + tipW / 2}
                    y={ty + tipH / 2 + 1.1}
                    textAnchor="middle"
                    className="fill-background"
                    style={{ fontSize: "3.4px", fontWeight: 600 }}
                  >
                    {`${buckets[i].label}: ${values[i]} respons`}
                  </text>
                </>
              );
            })()}
          </g>
        ) : null}
      </svg>

      {/* Tabel tersembunyi untuk pembaca layar (alternatif teks, 3.E) */}
      <table className="sr-only">
        <caption>Respons per bulan dan form dibuka</caption>
        <thead>
          <tr>
            <th scope="col">Bulan</th>
            <th scope="col">Respons</th>
            <th scope="col">Form dibuka</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.labelLong}</th>
              <td>{responseCounts[b.key] ?? 0}</td>
              <td>{formOpenedCounts[b.key] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
