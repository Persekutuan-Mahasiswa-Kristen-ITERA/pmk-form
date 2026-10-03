// Stub `react` untuk tes unit Node murni. Hanya sediakan `cache` sebagai
// identitas — cukup karena helper yang diuji tidak membutuhkannya.
export function cache(fn) {
  return fn;
}
