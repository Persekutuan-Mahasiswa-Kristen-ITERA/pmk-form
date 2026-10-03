import Image from "next/image";

/**
 * Satu-satunya sumber URL logo PMK ITERA (Fase 2-5).
 *
 * Dipakai di: landing, admin login, admin layout, halaman sukses, dan renderer
 * form. Sebelumnya URL Cloudinary ini diduplikasi di 6 tempat — jika perlu
 * mengganti logo, cukup ubah di sini.
 *
 * `next.config` sudah mengizinkan hostname `res.cloudinary.com`
 * (remotePatterns), jangan hapus.
 */
export const PMK_LOGO_URL =
  "https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif";

export const PMK_LOGO_ALT = "PMK ITERA Logo";

interface PMKLogoProps {
  /** Lebar elemen pembungkus (px). Default 120. */
  size?: number;
  className?: string;
  /** Prioritas loading (untuk logo di atas fold). Default true. */
  priority?: boolean;
}

/**
 * Logo PMK dengan pembungkus bundar bermotif emas yang seragam di seluruh app.
 * `size` mengatur dimensi pembungkus; gambar di-scale mengikuti.
 */
export function PMKLogo({ size = 120, className = "", priority = true }: PMKLogoProps) {
  return (
    <div
      className={`relative rounded-full border-4 border-accent shadow-lg bg-white flex items-center justify-center p-2 z-10 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={PMK_LOGO_URL}
        alt={PMK_LOGO_ALT}
        width={size}
        height={size}
        className="object-contain"
        priority={priority}
      />
    </div>
  );
}
