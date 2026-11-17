/** Aman untuk client: dipakai halaman login dan route /auth/google/finish. */
export type GoogleLoginError = "notRegistered" | "inactive" | "failed";

/** Kode error dari PI-CORE (atau dari kita sendiri) → kode aman untuk halaman login. */
export function googleLoginError(raw: string | null): GoogleLoginError {
    return raw === "notRegistered" || raw === "inactive" ? raw : "failed";
}

export const GOOGLE_LOGIN_MESSAGES: Record<GoogleLoginError, string> = {
    notRegistered: "Akun Google ini belum punya akun PI-CORE. Minta admin PI-CORE membuatkan akun dengan email ini.",
    inactive: "Akun PI-CORE Anda tidak aktif. Hubungi admin PI-CORE.",
    failed: "Masuk dengan Google gagal. Silakan coba lagi.",
};
