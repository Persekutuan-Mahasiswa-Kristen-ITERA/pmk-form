// Stub `server-only` untuk tes unit Node murni (tidak dipakai saat build).
// Di Next.js asli, modul ini melempar error bila diimpor dari Client Component
// — perilaku yang kita ingin pertahankan di produksi. Tapi di runner tes Node
// biasa, impor tersebut hanya menghambat pengujian fungsi server yang murni
// (seperti verifyTurnstileToken). Stub ini sengaja kosong (no-op).
export {};
