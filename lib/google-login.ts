import { randomBytes, timingSafeEqual } from "node:crypto";
import { PICORE_URL } from "@/lib/picore";
export { googleLoginError, type GoogleLoginError } from "@/lib/google-login-messages";

/**
 * "Masuk dengan Google" lewat PI-CORE (PI-CORE D-14).
 *
 * pmk-form tidak bicara dengan Google. Alurnya:
 *   /auth/google          buat nilai acak `handoff`, simpan di cookie httpOnly, kirim ke PI-CORE
 *   PI-CORE ↔ Google      PI-CORE memverifikasi akun Google dan mencocokkan dengan anggota aktif
 *   /auth/google/finish   PI-CORE mengembalikan `handoff` + token sekali pakai; `handoff` harus sama
 *                         dengan cookie (mencegah login CSRF), lalu token ditukar jadi sesi pmk-form.
 * Hak admin tetap dicek seperti login password (form.admin_members + status anggota PI-CORE).
 */
export const HANDOFF_COOKIE = "pmk_form_google";
export const HANDOFF_COOKIE_PATH = "/auth/google";
export const HANDOFF_COOKIE_MAX_AGE = 10 * 60;

export function newHandoff(): string {
    return randomBytes(32).toString("base64url");
}

export function picoreGoogleUrl(handoff: string): string {
    const url = new URL("/auth/google", PICORE_URL);
    url.searchParams.set("app", "form");
    url.searchParams.set("handoff", handoff);
    return url.toString();
}

export function handoffMatches(expected: string | undefined, received: string | null): boolean {
    if (!expected || !received) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
}
