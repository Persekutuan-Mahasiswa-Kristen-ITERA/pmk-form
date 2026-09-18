"use client";

import dynamic from "next/dynamic";
const GoldenParticles = dynamic(
  () => import("@/components/GoldenParticles").then((mod) => mod.GoldenParticles),
  { ssr: false }
);
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import QRCode from "react-qr-code";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function GenericSuccessPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [waGroupLink, setWaGroupLink] = useState<string | null>(null);
  const [thankYouMessage, setThankYouMessage] = useState<string>("Respons kamu telah berhasil kami terima.");
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const fetchFormDetails = async () => {
      if (!slug) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("forms")
        .select("settings")
        .eq("slug", slug)
        .single();

      if (data?.settings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = data.settings as Record<string, any>;
        if (settings.wa_group_link) setWaGroupLink(settings.wa_group_link);
        if (settings.thank_you_message) setThankYouMessage(settings.thank_you_message);
      }
      setIsLoading(false);
    };

    fetchFormDetails();
  }, [slug]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background px-4">
        <GoldenParticles />
        <div className="z-10 text-primary font-serif animate-pulse">Memuat...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 0.8], scale: [0.8, 1.2, 1] }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
      >
        <div className="w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] bg-accent/20 rounded-full blur-[100px]" />
      </motion.div>

      <GoldenParticles />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="z-10 bg-white/80 backdrop-blur-md p-10 md:p-14 rounded-[3rem] shadow-2xl border border-accent/30 max-w-lg w-full text-center flex flex-col items-center"
      >
        <div className="bg-primary/10 p-4 rounded-full mb-6 border-2 border-accent/20 shadow-inner">
          <Image
            src="https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif"
            alt="PMK ITERA Logo"
            width={100}
            height={100}
            className="drop-shadow-md"
            priority
          />
        </div>

        <h1 className="font-serif text-3xl md:text-5xl font-bold text-primary mb-4 drop-shadow-sm">Terima Kasih!</h1>
        <p className="text-lg md:text-xl font-serif text-foreground/80 mb-8 leading-relaxed">{thankYouMessage}</p>

        {waGroupLink && (
          <div className="bg-highlight/20 border-2 border-accent/40 rounded-3xl p-6 mb-8 w-full shadow-inner flex flex-col items-center space-y-5">
            <div className="text-center">
              <h2 className="font-serif text-xl font-bold text-primary mb-1">Grup WhatsApp</h2>
              <p className="text-sm text-muted-foreground">Scan QR Code atau klik tombol untuk bergabung ke grup</p>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-sm border border-accent/20">
              <QRCode value={waGroupLink} size={160} fgColor="#2C1810" bgColor="#FFFFFF" />
            </div>

            <Button asChild className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-xl py-6 shadow-md">
              <a href={waGroupLink} target="_blank" rel="noopener noreferrer">
                Gabung Grup WhatsApp 📲
              </a>
            </Button>

            <div className="flex items-center space-x-3 bg-white p-4 rounded-xl border border-accent/20 w-full mt-2">
              <Checkbox
                id="joined-wa"
                checked={isJoined}
                onCheckedChange={(c) => setIsJoined(c as boolean)}
                className="w-5 h-5"
              />
              <Label htmlFor="joined-wa" className="font-medium cursor-pointer text-sm">
                Saya sudah bergabung ke grup WhatsApp
              </Label>
            </div>
          </div>
        )}

        {!waGroupLink || isJoined ? (
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl py-6 px-8 text-lg font-bold shadow-lg w-full">
            <Link href="/">Selesai</Link>
          </Button>
        ) : (
          <Button disabled className="bg-muted text-muted-foreground rounded-2xl py-6 px-8 text-lg font-bold w-full">
            Selesai
          </Button>
        )}
      </motion.div>
    </main>
  );
}
