import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { HANDOFF_COOKIE, HANDOFF_COOKIE_PATH, googleLoginError, handoffMatches } from "@/lib/google-login";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/google/finish?handoff=…&token_hash=…  (atau &error=…) — PI-CORE mengembalikan browser ke sini.
 * Token hanya ditukar bila `handoff` sama dengan cookie yang kita pasang di /auth/google.
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const store = await cookies();
    const expected = store.get(HANDOFF_COOKIE)?.value;
    store.set(HANDOFF_COOKIE, "", { path: HANDOFF_COOKIE_PATH, maxAge: 0 });

    // Relative Location: stays on the host the browser used (the cookies above belong to it).
    const go = (path: string) =>
        new NextResponse(null, { status: 303, headers: { Location: path, "Referrer-Policy": "no-referrer" } });
    const fail = (raw: string | null) => go(`/admin/login?google=${googleLoginError(raw)}`);

    if (!handoffMatches(expected, url.searchParams.get("handoff"))) return fail("failed");
    if (url.searchParams.get("error")) return fail(url.searchParams.get("error"));

    const tokenHash = url.searchParams.get("token_hash");
    if (!tokenHash || url.searchParams.get("type") !== "magiclink") return fail("failed");

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (error) {
        console.error("Google login: token from PI-CORE was not accepted", error.message);
        return fail("failed");
    }
    return go("/admin/dashboard");
}
