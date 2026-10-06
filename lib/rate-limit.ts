/**
 * In-memory rate limiter (fixed window per key) — FALLBACK ONLY.
 *
 * CARA PAKAI: {@link rateLimit} dengan key unik per sumber daya, mis.\
 * `rateLimit("submit:" + ip, 10, 60_000)` atau `rateLimit("cekhasil:" + ip, 15, 60_000)`.
 *
 * !!! KEKURANGAN IN-MEMORY LIMITER (baca sebelum andalkan ini) !!!
 * State disimpan di memori proses Node saja. Pada platform serverless
 * (**Vercel Functions**), setiap instance / cold start punya map sendiri,
 * sehingga batas bisa dilanggar lintas instance. Vercel juga menduplikasi
 * instance saat scale-out, jadi penyerang yang request menyebar ke banyak
 * instance mendapat kuota penuh PER instance. Ini lapisan pertahanan PERTAMA
 * (menghambat brute-force & spam naif), BUKAN pengganti rate limiting
 * terdistribusi (Upstash Redis, atau KV) untuk beban produksi yang
 * sesungguhnya.
 *
 * Fase 8-3: Jika env UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * tersedia, rateLimit() otomatis menggunakan Upstash (terdistribusi, andal
 * di serverless). Jika tidak, gunakan in-memory (lapisan pertama).
 *
 * Selain itu, pembersihan entri kedaluwarsa (lihat MAX_ENTRIES) hanya
 * berjalan saat map penuh. Pada beban rendah entri kedaluwarsa menetap di
 * memori sampai limit tercapai - tidak signifikan untuk key berbasis IP.
 */

interface LimitEntry {
  count: number;
  resetAt: number;
}

const limitMap = new Map<string, LimitEntry>();

// Batas map agar tidak tumbuh tak terhingga. Saat limit tercapai, hanya entri
// yang KEDALUWARSA yang dibuang (bukan seluruh map), agar user aktif tidak
// tiba-tiba di-reset kuotanya hanya karena traffic tinggi.
const MAX_ENTRIES = 10_000;

/**
 * Returns true jika key ini sudah melampaui `limit` dalam window `windowMs`.
 * Tidak throws; pemanggil menentukan respons (mis. HTTP 429).
 *
 * Fase 8-3: Jika UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN tersedia,
 * gunakan Upstash Redis (terdistribusi, andal di serverless). Jika gagal
 * atau tidak dikonfigurasi, fallback ke in-memory limiter (async wrapper).
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  // Coba Upstash dulu jika dikonfigurasi
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await rateLimitUpstash(key, limit, windowMs);
    } catch (err) {
      console.warn("[rate-limit] Upstash gagal, fallback ke in-memory:", err instanceof Error ? err.message : "unknown");
    }
  }
  // Fallback: in-memory (synchronous)
  return rateLimitMemory(key, limit, windowMs);
}

/**
 * Upstash Redis rate limiter — sliding window log.
 * Menggunakan atomic script untuk thread-safety di lingkungan serverless.
 */
async function rateLimitUpstash(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowSec = Math.ceil(windowMs / 1000);
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/pipeline`;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN as string;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      // Hapus entry kadaluarsa, tambahkan request baru, cek count, set expiry
      ["ZREMRANGEBYSCORE", key, 0, now - windowMs],
      ["ZADD", key, now, `${now}-${Math.random()}`],
      ["ZCARD", key],
      ["EXPIRE", key, windowSec],
    ]),
    cache: "no-store",
    next: { tags: [`rl:${key}`] },
  });

  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const results = await res.json() as unknown[];
  // results[2] = ZCARD result (count setelah insert)
  const count = typeof results[2] === "number" ? results[2] : 0;
  return count > limit;
}

/** In-memory rate limiter (synchronous) — fallback, lihat JSDoc di atas. */
function rateLimitMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Buang entri kedaluwarsa. Dijalankan hanya saat map mendekati penuh agar
  // tidak membebani setiap pemanggilan; lakukan evict selektif (expired only),
  // jangan clear() seluruhnya.
  if (limitMap.size >= MAX_ENTRIES) {
    for (const [k, entry] of limitMap) {
      if (now > entry.resetAt) limitMap.delete(k);
    }
    // Jika setelah evict masih penuh (semua masih aktif), hapus sebagian
    // entri tertua agar tidak denial-of-service pada memory.
    if (limitMap.size >= MAX_ENTRIES) {
      const oldest = [...limitMap.entries()]
        .sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.ceil(MAX_ENTRIES * 0.1));
      for (const [k] of oldest) limitMap.delete(k);
    }
  }

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
 * !!! PENTING: header `x-forwarded-for` BISA dipalsukan client !!!
 * Client bebas mengirim `x-forwarded-for: 1.2.3.4` palsu; proxy hanya
 * MENAMBAHKAN IP hop sebelumnya di AKHIR daftar. Akibatnya:
 *   - elemen PERTAMA (kiri)  = nilai yang dikirim client sendiri (TIDAK tepercaya),
 *   - elemen TERAKHIR (kanan) = ditambah proxy tepercaya di depan server.
 *
 * URUTAN HEADER bergantung pada platform deployment (env TRUSTED_PROXY),
 * karena asumsi "header X diisi platform" hanya valid di platform itu.
 * Default: "vercel".
 *
 *   TRUSTED_PROXY=vercel (default)
 *     1. x-vercel-forwarded-for  — diisi infrastruktur Vercel, client tidak
 *                                  bisa menimpanya. Sumber paling tepercaya.
 *     2. x-real-ip               — diisi Vercel, IP client asli (nilai tunggal).
 *     3. x-forwarded-for         — ambil elemen TERAKHIR (kanan) sebagai fallback.
 *
 *   TRUSTED_PROXY=cloudflare
 *     1. cf-connecting-ip        — diisi Cloudflare, client tidak bisa menimpa.
 *     2. x-forwarded-for         — fallback elemen terakhir.
 *
 *   TRUSTED_PROXY=nginx   (reverse proxy sendiri; ANDAIHAN nginx di-deploy
 *                          dipercaya dan menulis x-real-ip / x-forwarded-for)
 *     1. x-real-ip               — asumsi nginx set header ini (nilai tunggal).
 *     2. x-forwarded-for         — fallback elemen terakhir.
 *
 *   TRUSTED_PROXY=none    (tidak ada proxy tepercaya; mis. dev lokal)
 *     Hanya x-forwarded-for elemen terakhir. Untuk dev, ini biasanya IP
 *     loopback. JANGAN pakai di produksi tanpa proxy di depan, karena
 *     tidak ada header yang terbukti tidak bisa dipalsukan client.
 *
 * !!! WAJIB DI-SET DI DEPLOYMENT !!!
 *   Default saat env TIDAK di-set atau kosong: "vercel" (sesuai platform
 *   kita sekarang).
 *   Jika di-set ke nilai yang TIDAK dikenal (mis. typo "vercl"), kode
 *   FAIL-SAFE ke mode "vercel" - bukan "none" - agar proteksi anti-spoofing
 *   tidak pernah hilang secara tak sengaja.
 *
 *   Yang harus di-set per platform:
 *     Vercel       -> TRUSTED_PROXY=vercel     (atau biarkan default)
 *     Cloudflare   -> TRUSTED_PROXY=cloudflare
 *     VPS + nginx  -> TRUSTED_PROXY=nginx      (pastikan nginx menulis
 *                                                 x-real-ip via
 *                                                 proxy_set_header)
 *     Dev lokal    -> TRUSTED_PROXY=none
 *
 * !!! BAHAYA jika salah konfigurasi !!!
 *   Satu-satunya kondisi yang membuat SEMUA request berbagi satu bucket
 *   "anonymous" adalah: TIDAK ADA header platform terpilih DAN tidak ada
 *   x-forwarded-for sama sekali. Pada deployment nyata di belakang proxy,
 *   x-forwarded-for hampir selalu ada, sehingga fallback elemen terakhir
 *   selalu menghasilkan IP. Jika Anda melihat semua request diberi label
 *   "anonymous" di log, periksa: (1) nilai TRUSTED_PROXY, (2) apakah proxy
 *   di depan benar-benar mengirim header yang sesuai.
 *   Mengabaikan hal ini berarti rate limit tidak efektif (satu bucket untuk
 *   seluruh aplikasi -> pengguna sah diblokir saat satu penyerang memenuhi
 *   kuota).
 *
 * KEKURANGAN umum (semua mode): tidak ada header yang bisa membedakan IP
 * client asli dari NAT gateway yang dipakai banyak orang (mis. jaringan
 * kampus). User di balik NAT yang sama berbagi IP -> berbagi kuota rate
 * limit. Diterima sebagai trade-off; batas dipilih longgar (10/menit) untuk
 * meminimalkan false-positive pada NAT besar.
 *
 * Menerima objek Headers (bisa dari `req.headers` di route handler atau dari
 * `headers()` next/headers di server action).
 */
export function getClientIp(req: Headers): string {
  // !!! DEFAULT "vercel" - sesuai deployment kita. Jika env TRUSTED_PROXY
  // di-set ke nilai TIDAK dikenal, kita FAIL-SAFE ke mode "vercel" BUKAN ke
  // "none", agar tidak ada platform yang tanpa sengaja kehilangan proteksi
  // anti-spoofing. Lihat JSDoc untuk nilai yang harus di-set per platform.
  const raw = (process.env.TRUSTED_PROXY ?? "vercel").trim().toLowerCase();
  const trustedProxy = raw === "" ? "vercel" : raw;

  function lastHop(headerName: string): string | null {
    const value = req.get(headerName);
    if (!value) return null;
    // Elemen TERAKHIR (kanan) = ditambah proxy tepercaya, bukan client.
    const parts = value.split(",");
    const last = parts[parts.length - 1]?.trim();
    return last || null;
  }

  function singleValue(headerName: string): string | null {
    const value = req.get(headerName);
    if (!value) return null;
    // Header platform biasanya nilai tunggal; ambil elemen pertama.
    const first = value.split(",")[0]?.trim();
    return first || null;
  }

  // Header yang diisi platform (client tidak bisa menimpa), urutan per mode.
  const platformHeaders: Record<string, string[]> = {
    vercel: ["x-vercel-forwarded-for", "x-real-ip"],
    cloudflare: ["cf-connecting-ip"],
    nginx: ["x-real-ip"],
    none: [],
  };

  const headers = platformHeaders[trustedProxy] ?? platformHeaders.vercel;
  for (const header of headers) {
    const ip = singleValue(header);
    if (ip) return ip;
  }

  // Fallback universal: elemen TERAKHIR x-forwarded-for.
  const forwardedLast = lastHop("x-forwarded-for");
  if (forwardedLast) return forwardedLast;

  // Tidak ada header sama sekali.
  return "anonymous";
}
