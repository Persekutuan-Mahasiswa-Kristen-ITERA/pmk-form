"use client";

import dynamic from "next/dynamic";

// Lazy-load BibleVerseBanner untuk mengurangi ukuran initial bundle.
// Komponen ini hanya dekorasi visual dan tidak mengandung konten penting.
const BibleVerseBanner = dynamic(
  () => import("@/components/BibleVerseBanner").then((mod) => mod.BibleVerseBanner),
  { ssr: false }
);

export { BibleVerseBanner };
