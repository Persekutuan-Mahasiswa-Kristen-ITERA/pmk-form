import { NextResponse, type NextRequest } from "next/server";

import { processOutboxBatch } from "@/lib/sheets/sync";

/**
 * Cron endpoint: retry sinkronisasi Sheets yang tertunda (Fase 6-3).
 *
 * !!! KEAMANAN: dipanggil tanpa session user (Vercel Cron / eksternal), jadi
 * dilindungi `CRON_SECRET` dengan perbandingan CONSTANT-TIME (timing-safe).
 * Header: `Authorization: Bearer <CRON_SECRET>`.
 *
 * !!! TIDAK boleh menerima input yang mempengaruhi query (ID form, dll):
 *     cron selalu memproses outbox global sesuai batch.
 *
 * Cara menjadwalkan: Vercel Cron (`vercel.json`) atau layanan eksternal
 * (cron-job.org / GitHub Actions schedule) yang memanggil endpoint ini.
 */

/** Bandingkan dua string secara constant-time (cegah timing attack). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Konfigurasi belum ada: tolak (jangan pernah jalankan tanpa proteksi).
    return NextResponse.json({ error: "Cron secret tidak dikonfigurasi." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !timingSafeEqual(token, secret)) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    const result = await processOutboxBatch(50);
    // Hanya log jumlah (tanpa PII). Pesan aman untuk response.
    console.info("[sheets-sync] cron selesai", result);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    // Jangan bocorkan detail error ke response publik.
    console.error("[sheets-sync] cron gagal:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ ok: false, error: "Sinkronisasi gagal. Coba lagi nanti." }, { status: 500 });
  }
}
