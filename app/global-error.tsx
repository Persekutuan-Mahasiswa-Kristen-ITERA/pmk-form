"use client";

/**
 * Global error boundary (UI Overhaul U1).
 *
 * Menggantikan root layout saat error fatal terjadi, jadi WAJIB merender
 * `<html>` + `<body>` sendiri. Karena layout (yang memuat font) di-bypass,
 * font fallback ke serif/sans sistem — tetap rapi tanpa memuat aset baru.
 *
 * Aman: pesan generik, tanpa stack trace, tanpa PII.
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error digest:", error.digest);
  }, [error.digest]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          backgroundColor: "#F8F6F0",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#2C1810",
        }}
      >
        <main
          style={{
            display: "flex",
            minHeight: "100dvh",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem 1rem 2rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "32rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.5rem",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h1
                style={{
                  fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Terjadi kesalahan
              </h1>
              <p style={{ fontSize: "0.95rem", color: "#824730", margin: 0 }}>
                Maaf, aplikasi tidak dapat dimuat. Coba muat ulang halaman ini.
                Bila masalah berlanjut, kembali beberapa saat lagi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.625rem 1.5rem",
                borderRadius: "0.75rem",
                border: "1px solid #E8DDC9",
                backgroundColor: "#fff",
                color: "#2C1810",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Coba lagi
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error bypass root layout (tidak ada provider); <Link> tidak bisa dipakai di sini */}
            <a
              href="/"
              style={{
                fontSize: "0.85rem",
                color: "#9F512C",
                textDecoration: "underline",
              }}
            >
              Kembali ke beranda
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
