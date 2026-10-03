import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Bentuk baris selection_results yang dipakai endpoint ini.
type SelectionPlacement = {
  nim: string;
  nama: string;
  prodi: string | null;
  departemen: string;
  divisi: string;
  wa_group_link: string | null;
};

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
  const ip = getClientIp(req.headers);

  // Rate limit per IP: 15 permintaan / menit. Lihat catatan di lib/rate-limit:
  // in-memory limiter tidak andal lintas instance serverless.
  if (rateLimit(`cek-hasil:${ip}`, 15, 60_000)) {
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

    // 1. Cek submissions lama (legacy) berdasarkan NIM + Email (dan formId jika dipilih).
    //    Fase 3-2b: form generik baru menyimpan identitas di form_responses.answers
    //    dengan key field_applicant_nim / field_applicant_email. Jika submissions
    //    tidak ada, cek form_responses agar respons form baru terlayani juga.
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

    // Fallback: cari di form_responses (form generik baru). NIM & email disimpan
    // di kolom answers dengan key field_applicant_nim / field_applicant_email
    // (lihat resolveFormFields di lib/forms.ts).
    let applicantName: string | null = null;
    if (!submissions || submissions.length === 0) {
      let frQuery = supabase
        .from("form_responses")
        .select("answers")
        .contains("answers", { field_applicant_nim: cleanNim, field_applicant_email: cleanEmail });

      if (formId) {
        frQuery = frQuery.eq("form_id", formId);
      }

      const { data: responses, error: frError } = await frQuery.limit(1);
      if (frError) {
        console.error("Error querying form_responses:", frError);
        return NextResponse.json({ error: "Terjadi kesalahan sistem. Silakan coba lagi nanti." }, { status: 500 });
      }

      if (!responses || responses.length === 0) {
        return NextResponse.json({
          status: "NOT_REGISTERED",
          message: "Kombinasi NIM dan email tidak ditemukan pada form ini. Pastikan pilihan form dan data yang dimasukkan sudah benar.",
        });
      }

      const answers = (responses[0].answers ?? {}) as Record<string, unknown>;
      const nameFromAnswers = answers["field_applicant_name"];
      applicantName = typeof nameFromAnswers === "string" && nameFromAnswers.trim() !== "" ? nameFromAnswers : cleanNim;
    } else {
      applicantName = submissions[0].applicant_name;
    }

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
