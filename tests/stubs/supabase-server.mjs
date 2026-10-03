// Stub `@/lib/supabase/server` untuk tes unit Node murni.
// createClient asli memakai next/headers + cookies request; di sini cukup
// lempar error jelas bila ada yang memanggil klien DB saat tes — helper PURE
// tidak pernah memanggilnya.
export async function createClient() {
  throw new Error(
    "createClient() dipanggil dalam tes unit — helper yang diuji harus PURE."
  );
}
