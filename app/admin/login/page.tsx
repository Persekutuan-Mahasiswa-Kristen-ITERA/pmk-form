import AdminLoginForm from "./login-form";
import { GOOGLE_LOGIN_MESSAGES, googleLoginError } from "@/lib/google-login-messages";

/** /admin/login — `?google=<kode>` muncul saat kembali dari "Masuk dengan Google" yang gagal. */
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ google?: string | string[] }> }) {
    const { google } = await searchParams;
    const code = typeof google === "string" ? google : null;
    return <AdminLoginForm googleError={code ? GOOGLE_LOGIN_MESSAGES[googleLoginError(code)] : undefined} />;
}
