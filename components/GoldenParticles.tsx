"use client";

import { useEffect, useState } from "react";

interface Particle {
    id: number;
    x: number;
    drift: number;
    size: number;
    duration: number;
    delay: number;
}

/**
 * Dekorasi partikel emas melayang.
 *
 * Catatan optimasi: animasi sebelumnya memakai framer-motion (motion.div per
 * partikel), yang menarik seluruh runtime framer-motion (~35–40 KB gzip) hanya
 * untuk efek dekoratif. Sekarang animasi digerakkan murni oleh CSS keyframes
 * (lihat kelas .particle-orb di globals.css) — berjalan di compositor, tanpa
 * JS per frame. Hook useReducedMotion diganti cek matchMedia langsung.
 */
export function GoldenParticles() {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setShouldReduceMotion(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        if (shouldReduceMotion) return;

        // Throttled generation to prevent main thread blocking during initial render
        const animationFrameId = requestAnimationFrame(() => {
            const newParticles: Particle[] = Array.from({ length: 30 }).map((_, i) => ({
                id: i,
                x: Math.random() * 100, // vw
                drift: Math.random() * 10 - 5,
                size: Math.random() * 10 + 4, // px
                duration: Math.random() * 20 + 15, // sec
                delay: Math.random() * 10,
            }));
            setParticles(newParticles);
        });

        return () => cancelAnimationFrame(animationFrameId);
    }, [shouldReduceMotion]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-background">
            {/* Soft gradient overlay for the warm cream feel */}
            <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/30 opacity-70" />

            {/* Floating Gold Orbs — CSS keyframes, compositor-friendly */}
            {!shouldReduceMotion && particles.map((p) => (
                <div
                    key={p.id}
                    className="particle-orb absolute rounded-full bg-accent blur-[2px]"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: `${p.x}vw`,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`,
                        ["--drift" as string]: `${p.drift}vw`,
                    }}
                />
            ))}

            {/* Subtle Cross Watermark (SVG) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02]">
                <svg
                    width="800"
                    height="800"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A0522D"
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 2v20M5 8h14" />
                </svg>
            </div>
        </div>
    );
}
