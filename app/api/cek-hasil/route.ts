import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Bentuk baris selection_results yang dipakai endpoint ini.
type SelectionPlacement = {
  nim: string;
  nama: string;
  prodi: string | null;
  departemen: string;
  divisi: string;
  wa_group_link: string | null;
};

// Rate limiting in-memory sederhana per IP (max 15 request per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limitInfo = rateLimitMap.get(ip);

  if (!limitInfo || now > limitInfo.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return false;
  }

  if (limitInfo.count >= 15) {
    return true;
  }

  limitInfo.count += 1;
  return false;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase Service Role configuration");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(req: Request) {
  // "x-forwarded-for" bisa berisi daftar IP yang dipisah koma (proxy chain).
  // Ambil hop pertama = IP client asli. Kalau tidak ada, fallback x-real-ip.
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : req.headers.get("x-real-ip") || "anonymous";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Silakan tunggu beberapa saat." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const rawNim = body?.nim;
    const rawEmail = body?.email;
    const formId = body?.formId; // Kustomisasi form / recruitment tertentu (opsional)

    if (!rawNim || typeof rawNim !== "string") {
      return NextResponse.json({ error: "NIM wajib diisi." }, { status: 400 });
    }

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
    }

    const cleanNim = rawNim.trim();
    const cleanEmail = rawEmail.trim().toLowerCase();

    if (!/^\d{7,10}$/.test(cleanNim)) {
      return NextResponse.json({ error: "Format NIM tidak valid. NIM harus berupa angka." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 1. Cek submissions berdasarkan NIM + Email (dan formId jika dipilih)
    let subQuery = supabase
      .from("submissions")
      .select("applicant_name, applicant_nim, applicant_email, recruitment_id")
      .eq("applicant_nim", cleanNim)
      .eq("applicant_email", cleanEmail);

    if (formId) {
      subQuery = subQuery.eq("recruitment_id", formId);
    }

    const { data: submissions, error: subError } = await subQuery.limit(1);

    if (subError) {
      console.error("Error querying submissions:", subError);
      return NextResponse.json({ error: "Terjadi kesalahan sistem. Silakan coba lagi nanti." }, { status: 500 });
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        status: "NOT_REGISTERED",
        message: "Kombinasi NIM dan email tidak ditemukan pada rekrutmen ini. Pastikan pilihan recruitment dan data yang dimasukkan sudah benar.",
      });
    }

    const applicantName = submissions[0].applicant_name;

    // 2. Cek hasil seleksi
    const { data: results, error: resError } = await supabase
      .from("selection_results")
      .select("nim, nama, prodi, departemen, divisi, wa_group_link")
      .eq("nim", cleanNim);

    if (resError) {
      console.error("Error querying selection_results:", resError);
      return NextResponse.json({ error: "Terjadi kesalahan sistem. Silakan coba lagi nanti." }, { status: 500 });
    }

    if (!results || results.length === 0) {
      return NextResponse.json({
        status: "NOT_ACCEPTED",
        nama: applicantName,
        message: `Halo ${applicantName}, terima kasih telah mendaftar dan mengikuti seluruh rangkaian seleksi. Mohon maaf, kamu belum lolos pada tahap ini. Tetap semangat dan terima kasih atas pelayananmu!`,
      });
    }

    return NextResponse.json({
      status: "ACCEPTED",
      nama: applicantName,
      placements: results.map((r: SelectionPlacement) => ({
        departemen: r.departemen,
        divisi: r.divisi === "Unknown" ? "-" : r.divisi,
        prodi: r.prodi,
        wa_group_link: r.wa_group_link || null,
      })),
      message: `Selamat, ${applicantName}! Kamu dinyatakan LOLOS seleksi! 🎉`,
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
  }
}
