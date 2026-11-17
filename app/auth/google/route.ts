import { NextResponse } from "next/server";
import {
    HANDOFF_COOKIE,
    HANDOFF_COOKIE_MAX_AGE,
    HANDOFF_COOKIE_PATH,
    newHandoff,
    picoreGoogleUrl,
} from "@/lib/google-login";

/** GET /auth/google — mulai "Masuk dengan Google" lewat PI-CORE (lihat lib/google-login.ts). */
export async function GET() {
    const handoff = newHandoff();
    const response = NextResponse.redirect(picoreGoogleUrl(handoff));
    response.cookies.set(HANDOFF_COOKIE, handoff, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // kembali dari PI-CORE lewat navigasi GET biasa
        path: HANDOFF_COOKIE_PATH,
        maxAge: HANDOFF_COOKIE_MAX_AGE,
    });
    return response;
}
