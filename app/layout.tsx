import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "PMK ITERA — Open Recruitment Portal",
  description: "Portal pendaftaran pelayanan dan kepanitiaan di PMK ITERA",
  icons: {
    icon: "/pmk-logo.avif",
  },
};

/**
 * Viewport mobile-first (UI Overhaul U1).
 *
 * - `viewportFit: "cover"` + `env(safe-area-inset-*)` di komponen bar tetap
 *   agar navbar/bottom bar tidak tertutup notch atau home indicator iOS.
 * - `themeColor` selaras dengan token `--background` (krem hangat).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F8F6F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">

      <body
        className={`${inter.variable} ${playfair.variable} antialiased font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
