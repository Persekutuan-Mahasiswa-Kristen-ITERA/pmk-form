import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client untuk Browser Components (RLS-aware).
 *
 * Hanya key anon (NEXT_PUBLIC_*), tidak pernah service-role.
 * Tidak ada fallback "dummy": env yang hilang adalah misconfig fatal.
 */
export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
        throw new Error(
            'Konfigurasi Supabase belum lengkap. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di environment.'
        )
    }

    return createBrowserClient(url, anonKey)
}
