"use client";

import { useState, useEffect } from "react";

const verses = [
    { text: "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku.", reference: "Filipi 4:13" },
    { text: "Karena masa depan sungguh ada, dan harapanmu tidak akan hilang.", reference: "Amsal 23:18" },
    { text: "Serahkanlah perbuatanmu kepada TUHAN, maka terlaksanalah segala rencanamu.", reference: "Amsal 16:3" },
    { text: "Janganlah hendaknya kerajinanmu kendor, biarlah rohmu menyala-nyala dan layanilah Tuhan.", reference: "Roma 12:11" },
    { text: "Tetapi carilah dahulu Kerajaan Allah dan kebenarannya, maka semuanya itu akan ditambahkan kepadamu.", reference: "Matius 6:33" },
];

export function BibleVerseBanner() {
    const [verse, setVerse] = useState(verses[0]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            setVerse(verses[Math.floor(Math.random() * verses.length)]);
            setMounted(true);
        });
        return () => cancelAnimationFrame(id);
    }, []);

    // Prevent layout shift by rendering invisible placeholder if unmounted
    if (!mounted) {
        return <div className="w-full bg-primary py-3 px-4 min-h-[48px] border-b border-accent shadow-sm" />;
    }

    return (
        <div className="w-full bg-primary text-primary-foreground py-3 px-4 text-center border-b border-accent shadow-sm transition-opacity duration-500">
            <p className="font-serif italic text-sm md:text-base">
                &quot;{verse.text}&quot; <span className="font-semibold not-italic ml-1">— {verse.reference}</span>
            </p>
        </div>
    );
}
