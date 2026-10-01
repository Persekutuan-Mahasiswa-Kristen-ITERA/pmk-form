/**
 * In-memory rate limiter (sliding window per key).
 *
 * CARA PAKAI: {@link rateLimit} dengan key unik per sumber daya, mis.
 * `rateLimit("submit:" + ip, 10, 60_000)` atau `rateLimit("cekhasil:" + ip, 15, 60_000)`.
 *
 * !!! KEKURANGAN IN-MEMORY LIMITER (baca sebelum andalkan ini) !!!
 * State disimpan di memori proses Node saja. Pada platform serverless
 * (**Vercel Functions**), setiap instance / cold start punya map sendiri,
 * sehingga batas bisa dilanggar lintas instance dan map bocor memori pada
 * traffic tinggi. Vercel juga menduplikasi instance saat scale-out, jadi
 * penyerang yang request menyebar ke banyak instance mendapat kuota penuh
 * PER instance. Ini adalah lapisan pertahanan PERTAMA (menghambat brute-force &
 * spam naif), BUKAN pengganti rate limiting terdistribusi (Upstash, Redis, atau
 * Supabase Edge Function with KV) untuk beban produksi yang sungguh-sungguh.
 * Pertimbangkan migrasi ke store eksternal di fase berikutnya.
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
 * !!! PENTING: urutan pembacaan header !!!
 * Header `x-forwarded-for` adalah daftar yang dipisah koma dan **BISA dipalsukan
 * client** — client bebas mengirim `x-forwarded-for: 1.2.3.4` palsu, dan proxy
 * hanya MENAMBAHKAN IP sebelumnya di akhir. Akibatnya elemen PERTAMA dari
 * `x-forwarded-for` adalah nilai yang dikirim client sendiri (tidak tepercaya),
 * sedangkan elemen **TERAKHIR** adalah yang ditambahkan oleh proxy tepercaya
 * yang berada tepat di depan server kita (Vercel) — itulah yang kita ambil.
 *
 * Urutan prioritas (platform deployment: **Vercel**):
 *  1. `x-vercel-forwarded-for` — diisi infrastruktur Vercel, client TIDAK bisa
 *     menimpanya. Ini sumber paling tepercaya.
 *  2. `x-real-ip` — diisi Vercel, berisi IP client asli (nilai tunggal).
 *  3. `x-forwarded-for` — AMBIL ELEMEN TERAKHIR (kanan), bukan pertama, karena
 *     itulah entri yang ditambah proxy tepercaya. Dipakai hanya jika kedua header
 *     di atas tidak ada (mis. dev lokal / proxy sendiri).
 *  4. "anonymous" — tidak ada header sama sekali (mis. dev).
 *
 * KEKURANGAN: tidak ada satupun header di atas yang bisa membedakan IP client
 * asli dari IP NAT gateway yang dipakai banyak orang (mis. jaringan kampus).
 * User di balik NAT yang sama berbagi IP -> berbagi kuota rate limit. Ini
 * diterima sebagai trade-off; batas dipilih longgar (10/menit) untuk
 * meminimalkan false-positive pada NAT besar.
 *
 * Menerima objek Headers (bisa dari `req.headers` di route handler atau dari
 * `headers()` next/headers di server action).
 */
export function getClientIp(req: Headers): string {
  function lastHop(headerName: string): string | null {
    const value = req.get(headerName);
    if (!value) return null;
    // Ambil elemen TERAKHIR (kanan) -> ditambah proxy tepercaya, bukan client.
    const parts = value.split(",");
    const last = parts[parts.length - 1]?.trim();
    return last || null;
  }

  function firstValue(headerName: string): string | null {
    const value = req.get(headerName);
    if (!value) return null;
    // x-vercel-forwarded-for / x-real-ip diisi Vercel; ambil elemen pertama.
    const first = value.split(",")[0]?.trim();
    return first || null;
  }

  // 1. Sumber paling tepercaya: diisi Vercel, client tidak bisa spoof.
  const vercelForwarded = firstValue("x-vercel-forwarded-for");
  if (vercelForwarded) return vercelForwarded;

  // 2. x-real-ip: diisi Vercel, nilai tunggal.
  const realIp = req.get("x-real-ip");
  if (realIp) return realIp.trim();

  // 3. Fallback: elemen TERAKHIR x-forwarded-for (proxy tepercaya).
  const forwardedLast = lastHop("x-forwarded-for");
  if (forwardedLast) return forwardedLast;

  // 4. Tidak ada header sama sekali.
  return "anonymous";
}
