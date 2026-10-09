import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Gunakan Next 16 cookie cache: cookies() di-cache per-request, jadi
// beberapa createServerClient() dalam satu request tidak re-parse cookie jar.
import { cookies } from 'next/headers'

export async function proxy(request: NextRequest) {
    // Hanya rute yang butuh session yang membuat client Supabase.
    // Halaman publik (/, /form/*) dan semua aset statis langsung diteruskan —
    // sebelumnya setiap request melalui matcher memanggil auth.getUser(),
    // yang menambah ~100-400ms round-trip ke Supabase bahkan untuk file statis.
    const pathname = request.nextUrl.pathname
    const needsSession =
        pathname.startsWith('/admin') || pathname.startsWith('/auth/callback')

    if (!needsSession) {
        return NextResponse.next()
    }

    const supabaseResponse = NextResponse.next({
        request,
    })

    const cookieStore = await cookies()

    // We need to create a Supabase client that can parse and set cookies
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        supabaseResponse.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // This will also refresh the session if necessary
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protect /admin routes (except login)
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/admin/login'
            return NextResponse.redirect(url)
        }
    }

    // Redirect authenticated user away from login page
    if (pathname === '/admin/login') {
        if (user) {
            const url = request.nextUrl.clone()
            url.pathname = '/admin/dashboard'
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
