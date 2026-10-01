import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for SERVER-SIDE use only.
 *
 * This client bypasses Row Level Security and must never be imported from a
 * Client Component or referenced by any code path that could leak
 * `SUPABASE_SERVICE_ROLE_KEY` to the browser. It exists for operations that
 * must run with elevated privileges while performing their own validation —
 * e.g. the public form-submission server action (which validates server-side
 * before writing), and the `/api/cek-hasil` route.
 *
 * The client is created per call and holds no session state.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Konfigurasi Supabase service role tidak ditemukan.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
