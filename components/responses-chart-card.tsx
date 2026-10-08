"use client";

/**
 * ResponsesChartCard — pembungkus interaktif grafik dashboard (UI Overhaul U2).
 *
 * Client component karena memegang state pilihan periode ("6 bulan" / "12
 * bulan") dan memuat ulang data grafik via server action saat periode berubah.
 *
 * Data diambil di server (`getResponseChartData`) — client hanya memicu
 * pengambilan ulang, tidak pernah menyentuh DB.
 */
import { useState, useTransition } from "react";
import { ResponsesChart } from "@/components/responses-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { Skeleton } from "@/components/skeleton";
import { loadChartAction, type ChartData } from "@/app/actions/dashboard-chart";

export function ResponsesChartCard({
  initialData,
  initialMonths,
}: {
  initialData: ChartData;
  initialMonths: number;
}) {
  const [months, setMonths] = useState<string>(String(initialMonths));
  const [data, setData] = useState<ChartData>(initialData);
  const [pending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    setMonths(value);
    startTransition(async () => {
      // Server action terpisah (app/actions/dashboard-chart.ts) — tidak boleh
      // mengimpor lib/dashboard.ts langsung ke client bundle (memakai
      // next/headers via createClient).
      const next = await loadChartAction(Number(value));
      setData(next);
    });
  };

  const loading = pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? "Memuat ulang data…"
            : `Menampilkan ${months} bulan terakhir · total ${data.total} respons`}
        </p>
        <SegmentedControl
          aria-label="Periode grafik"
          value={months}
          onChange={handleChange}
          options={[
            { value: "6", label: "6 bulan" },
            { value: "12", label: "12 bulan" },
          ]}
        />
      </div>

      {loading ? (
        // Skeleton saat memuat ulang (prompt 3.E mewajibkan skeleton).
        <Skeleton className="h-56 w-full rounded-xl" aria-hidden="true" />
      ) : (
        <ResponsesChart
          buckets={data.buckets}
          responseCounts={data.responseCounts}
          formOpenedCounts={data.formOpenedCounts}
          total={data.total}
          height={180}
        />
      )}

      {/* Legenda (satu tipe saja: batang respons) */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-1))]"
          />
          Respons per bulan
        </span>
      </div>
    </div>
  );
}
