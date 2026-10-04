import "server-only";

/**
 * Verifikasi token Cloudflare Turnstile di SERVER (Fase 7-2).
 *
 * !!! KEAMANAN: verifikasi WAJIB di server. Site key saja tidak cukup —
 * token harus divalidasi ke Cloudflare dengan SECRET KEY (tidak pernah
 * dikirim ke browser). Token sekali pakai: satu submit = satu verifikasi.
 *
 * Tanpa dependency baru: fetch ke endpoint siteverify Cloudflare.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Apakah fitur Turnstile dikonfigurasi (site key + secret ada)? */
export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY
  );
}

/**
 * Verifikasi token Turnstile ke Cloudflare.
 *
 * @returns true bila token valid (success=true). False + alasan bila tidak.
 *          Bila fitur belum dikonfigurasi, kembali true (fitur off global).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<{ ok: boolean; reason?: string }> {
  // Fitur belum dikonfigurasi -> tidak ada captcha -> lewati (fitur off).
  if (!isTurnstileConfigured()) {
    return { ok: true };
  }

  if (!token || token.trim() === "") {
    return { ok: false, reason: "Verifikasi keamanan belum diselesaikan." };
  }

  const form = new URLSearchParams();
  form.append("secret", process.env.TURNSTILE_SECRET_KEY as string);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      // Cloudflare sendiri bermasalah: JANGAN blokir pendaftar karena
      // infrastruktur pihak ketiga (sesuai prinsip: kegagalan eksternal
      // tidak menggagalkan submit). Log saja.
      console.warn("Turnstile siteverify HTTP", res.status);
      return { ok: true };
    }
    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      const codes = (data["error-codes"] ?? []).join(", ");
      return {
        ok: false,
        reason: codes
          ? `Verifikasi keamanan gagal (${codes}). Muat ulang halaman dan coba lagi.`
          : "Verifikasi keamanan gagal. Muat ulang halaman dan coba lagi.",
      };
    }
    return { ok: true };
  } catch (err) {
    // Gangguan jaringan ke Cloudflare: jangan hukum pendaftar.
    console.warn("Turnstile verify error (diizinkan lanjut):", err instanceof Error ? err.message : "unknown");
    return { ok: true };
  }
}
