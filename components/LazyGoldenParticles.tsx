"use client";

import dynamic from "next/dynamic";

// Lazy-load GoldenParticles untuk mengurangi ukuran initial bundle.
// Komponen ini hanya dekorasi visual (framer-motion animation) dan
// tidak mengandung konten penting untuk SEO/SSR.
const GoldenParticles = dynamic(
  () => import("@/components/GoldenParticles").then((mod) => mod.GoldenParticles),
  { ssr: false }
);

export { GoldenParticles };
