"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Widget Cloudflare Turnstile untuk form publik (Fase 7-2).
 *
 * Memakai script resmi Cloudflare (render explicit) — TANPA dependency npm
 * baru. Token dikirim ke server action lalu diverifikasi ke Cloudflare
 * dengan SECRET KEY (lihat lib/turnstile.ts).
 *
 * Catatan: site key bersifat PUBLIK (aman di browser). Secret key TIDAK.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script error")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Gagal memuat script Turnstile"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const handleToken = useCallback(
    (token: string) => {
      setStatus("ready");
      onToken(token);
    },
    [onToken]
  );

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        // Render ganda (StrictMode) dicegah: hanya render bila belum ada widget.
        if (widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "light",
          size: "normal",
          callback: handleToken,
          "error-callback": () => {
            if (!cancelled) setStatus("error");
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, handleToken]);

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>
          Verifikasi keamanan gagal dimuat. Nonaktifkan pemblokir iklan atau muat ulang
          halaman, lalu coba kirim lagi.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[65px] flex items-center" />
      {status === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Memuat verifikasi keamanan...
        </p>
      )}
    </div>
  );
}
