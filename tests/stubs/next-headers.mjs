// Stub `next/headers` untuk tes unit Node murni (tidak dipakai saat build).
// Menyediakan cookies()/headers() minimal agar createClient di supabase/server
// tidak meledak saat di-import. Fungsi yang diuji (isFormActive,
// resolveFormFields, normalizeNim) tidak menyentuh cookies sama sekali.
export async function cookies() {
  return {
    getAll() {
      return [];
    },
    setAll() {},
  };
}

export async function headers() {
  return new Headers();
}
