import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback (Fase 5-3).
 *
 * Supabase menukar `code` menjadi session di sini (PKCE). Setelah session
 * terbentuk, kita memanggil fungsi DB `link_admin_user_id()` yang menautkan
 * auth.uid() ke baris admin_members berdasarkan email TERVERIFIKASI.
 *
 * !!! TAMBAHAN #2: penautan dilakukan DI DATABASE lewat fungsi SECURITY
 * DEFINER TANPA PARAMETER. Aplikasi TIDAK pernah mengirim email dari client.
 * Lihat migrations/009 LANGKAH 5 untuk aturannya (email_confirmed_at wajib,
 * hanya user_id NULL atau pemilik, disabled tak bisa reaktivasi).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // request.url selalu valid (disediakan framework), tapi dibungkus defensif
  // agar callback tidak pernah melempar 500 ke pengguna.
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return NextResponse.redirect(new URL("/admin/login?error=invalid_request", "https://placeholder.invalid"));
  }
  const code = requestUrl.searchParams.get("code");
  // `next` = tujuan setelah login. Divalidasi ketat di bawah (anti open
  // redirect): hanya path internal relatif yang diizinkan.
  const nextParam = requestUrl.searchParams.get("next");

  if (!code) {
    // Tanpa code = alur rusak/dibatalkan. Kembalikan ke login dengan pesan.
    return NextResponse.redirect(
      new URL("/admin/login?error=oauth_cancelled", requestUrl.origin)
    );
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("OAuth exchange gagal:", exchangeError.message);
    return NextResponse.redirect(
      new URL("/admin/login?error=oauth_failed", requestUrl.origin)
    );
  }

  // Penautan user_id ke admin_members (hanya jika email ada di allowlist dan
  // terverifikasi). Fungsi DB yang memutuskan; aplikasi hanya memanggil.
  // Error di sini TIDAK fatal: user non-admin sah saja tidak punya baris.
  const { error: linkError } = await supabase.rpc("link_admin_user_id");
  if (linkError) {
    // Log untuk debugging; jangan blokir login (fungsi sudah fail-safe).
    console.error("link_admin_user_id gagal:", linkError.message);
  }

  // Validasi `next`: hanya path internal (mulai dengan "/" dan bukan "//").
  // Mencegah open redirect ke domain attacker.
  const safeNext = sanitizeNextPath(nextParam);

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}

/**
 * Hanya path internal relatif yang diizinkan sebagai tujuan redirect.
 *
 * - "//evil.com"      -> ditolak (bisa jadi protocol-relative URL)
 * - "https://evil.com" -> ditolak
 * - "/admin/dashboard" -> diizinkan
 * - null / ""          -> default /admin/dashboard
 */
function sanitizeNextPath(next: string | null): string {
  const fallback = "/admin/dashboard";
  if (!next) return fallback;
  // Hanya karakter aman di path; tolak yang memuat skema atau "//".
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes(":")) return fallback;
  return next;
}
