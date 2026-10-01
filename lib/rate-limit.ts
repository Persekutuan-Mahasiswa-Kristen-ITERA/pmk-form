/**
 * In-memory rate limiter (sliding window per key).
 *
 * CARA PAKAI: {@link rateLimit} dengan key unik per sumber daya, mis.
 * `rateLimit("submit:" + ip, 10, 60_000)` atau `rateLimit("cekhasil:" + ip, 15, 60_000)`.
 *
 * !!! KEKURANGAN IN-MEMORY LIMITER (baca sebelum andalkan ini) !!!
 * State disimpan di memori prosis Node saja. Pada platform serverless
 * (Vercel Functions, edge runtime, dsb.) setiap instance/cold start punya map
 * sendiri, sehingga batas bisa dilanggi lintas instance dan map bocor memori
 * pada traffic tinggi. Ini adalah lapisan pertahanan PERTAMA (menghambat
 * brute-force & spam naif), BUKAN pengganti rate limiting terdistribusi
 * (Upstash, Redis, Supabase Edge Function with KV, dsb.) untuk beban produksi
 * yang sungguh-sungguh. Pertimbangkan migrasi ke store eksternal di fase
 * berikutnya.
 */

interface LimitEntry {
  count: number;
  resetAt: number;
}

const limitMap = new Map<string, LimitEntry>();

// Batas map agar tidak tumbuh tak terhingga (key lama di-drop saat penuh).
const MAX_ENTRIES = 10_000;

/**
 * Returns true jika key ini sudah melampaui `limit` dalam window `windowMs`.
 * Tidak throws; pemanggil menentukan respons (mis. HTTP 429).
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  if (limitMap.size > MAX_ENTRIES) {
    limitMap.clear();
  }

  const now = Date.now();
  const entry = limitMap.get(key);

  if (!entry || now > entry.resetAt) {
    limitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= limit) {
    return true;
  }

  entry.count += 1;
  return false;
}

/**
 * Ambil IP client yang paling tepercaya dari request.
 *
 * `x-forwarded-for` BISA berisi daftar yang dipisah koma dan BISA dipalsukan
 * client. Karena reverse-proxy tepercaya platform (Vercel/nginx) menambahkan
 * IP client asli sebagai elemen PERTAMA dan tidak mengizinkan client
 * menimpanya, kita ambil elemen pertama. Fallback ke header yang diisi
 * platform (`x-vercel-forwarded-for`, `x-real-ip`) sebelum "anonymous".
 *
 * Menerima objek Headers (bisa dari `req.headers` di route handler atau dari
 * `headers()` next/headers di server action).
 */
export function getClientIp(req: Headers): string {
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }

  const vercelForwarded = req.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0].trim();
    if (first) return first;
  }

  return req.get("x-real-ip") || "anonymous";
}
