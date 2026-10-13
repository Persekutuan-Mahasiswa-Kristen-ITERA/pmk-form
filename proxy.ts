import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy (middleware) — gerbang awal rute admin.
 *
 * Catatan penting soal desain ini:
 * - Matcher sudah dipersempit ke /admin/* dan /auth/callback. Halaman publik
 *   (/, /form/*) dan semua aset statis TIDAK melalui proxy, jadi tidak ada
 *   pemeriksaan auth untuk mereka.
 * - Gating rute memakai auth.getClaims() (tersedia @supabase/supabase-js >=
 *   2.115): verifikasi SIGNATURE + kadaluarsa JWT secara LOKAL, tanpa
 *   round-trip ke server Supabase untuk setiap request. Sesuai arahan Supabase,
 *   getClaims() menangani kedua jenis JWT signing key: jika project memakai
 *   asymmetric keys, verifikasi memakai JWKS yang di-cache; jika masih memakai
 *   symmetric (HS256) secret, otomatis fallback ke getUser() — jadi behavior
 *   tidak pernah lebih lemah dari sebelumnya.
 * - getClaims() tanpa argumen memakai session dari cookie (bisa auto-refresh
 *   bila access token akan kedaluarsa); hasil refresh diteruskan ke response
 *   melalui setAll() di bawah.
 * - Proxy hanya gerbang awal: otorisasi sebenarnya tetap dilakukan
 *   requireAdmin()/RLS di server, yang memverifikasi ulang identitas dengan
 *   getUser() + query admin_members.
 */
export async function proxy(request: NextRequest) {
    // Response ini dibuat sekali di sini dan dipakai untuk SEMUA jalur keluar
    // (termasuk redirect), supaya cookie hasil setAll() — misalnya refresh
    // token — tidak hilang saat browser diarahkan ke halaman lain.
    const response = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value)
                    })
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // Verifikasi JWT secara lokal. Signature access token diceek, jadi payload
    // (termasuk sub) tidak bisa dipalsukan dari sisi klien. Error (mis. token
    // kedaluarsa yang tidak bisa di-refresh) diperlakukan sama seperti tidak
    // ada session: redirect ke login.
    const { data } = await supabase.auth.getClaims()
    const userId = data?.claims.sub

    const pathname = request.nextUrl.pathname

    // Lindungi rute /admin kecuali halaman login.
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
        if (!userId) {
            const url = request.nextUrl.clone()
            url.pathname = '/admin/login'
            return withCookies(NextResponse.redirect(url), response)
        }
    }

    // Arahkan user yang sudah login menjauhi halaman login.
    if (pathname === '/admin/login' && userId) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/dashboard'
        return withCookies(NextResponse.redirect(url), response)
    }

    return response
}

/**
 * Salin cookie dari `response` (yang mungkin sudah diisi setAll) ke response
 * redirect, supaya session hasil refresh tidak hilang saat redirect.
 */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
    for (const cookie of source.cookies.getAll()) {
        target.cookies.set(cookie)
    }
    return target
}

export const config = {
    matcher: [
        // Rute yang butuh cek session: area admin dan callback OAuth.
        // Aset statis, halaman publik, dan endpoint publik lain tidak
        // melalui proxy sama sekali.
        '/admin/:path*',
        '/auth/callback',
    ],
}
