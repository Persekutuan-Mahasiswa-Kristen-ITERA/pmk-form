"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

interface Particle {
    id: number;
    x: number;
    y: number;
    drift: number;
    size: number;
    duration: number;
    delay: number;
}

export function GoldenParticles() {
    const [particles, setParticles] = useState<Particle[]>([]);
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
        if (shouldReduceMotion) return; // Do not generate floating particles if reduced motion is preferred

        // Throttled generation to prevent main thread blocking during initial render
        const animationFrameId = requestAnimationFrame(() => {
            const newParticles: Particle[] = Array.from({ length: 30 }).map((_, i) => ({
                id: i,
                x: Math.random() * 100, // vw
                y: Math.random() * 100, // vh
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

            {/* Floating Gold Orbs */}
            {!shouldReduceMotion && particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full bg-accent blur-[2px] opacity-30"
                    style={{ willChange: "transform, opacity" }}
                    initial={{
                        x: `${p.x}vw`,
                        y: "110vh",
                        width: p.size,
                        height: p.size,
                        opacity: 0,
                    }}
                    animate={{
                        y: "-10vh",
                        x: `${p.x + p.drift}vw`,
                        opacity: [0, 0.4, 0.4, 0],
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        ease: "linear",
                        delay: p.delay,
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
