"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GoldenParticles } from "@/components/GoldenParticles";
import { BibleVerseBanner } from "@/components/BibleVerseBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ArrowLeft, CheckCircle2, XCircle, AlertCircle, Sparkles, MessageCircle, ExternalLink } from "lucide-react";

type ResultState = {
  status: "ACCEPTED" | "NOT_ACCEPTED" | "NOT_REGISTERED";
  nama?: string;
  message: string;
  placements?: { 
    departemen: string; 
    divisi: string; 
    prodi?: string;
    wa_group_link?: string | null;
  }[];
} | null;

export default function HasilSeleksiPage() {
  const [nim, setNim] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nim.trim()) {
      setError("Masukkan NIM kamu terlebih dahulu.");
      return;
    }
    if (!email.trim()) {
      setError("Masukkan email kamu terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/cek-hasil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nim: nim.trim(), email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memeriksa kelulusan.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center pb-16 relative w-full overflow-x-hidden bg-[#FAF6F0]">
      <GoldenParticles />
      <BibleVerseBanner />

      <div className="w-full max-w-2xl px-4 flex flex-col items-center pt-12 mt-2 z-10">
        {/* Back Link */}
        <div className="w-full flex justify-start mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors bg-white/80 px-4 py-2 rounded-xl shadow-sm border border-border/40"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        {/* Logo */}
        <div className="relative w-24 h-24 md:w-28 md:h-28 mb-6 rounded-full border-4 border-accent shadow-xl bg-white flex items-center justify-center p-2 overflow-hidden">
          <Image
            src="https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif"
            alt="PMK ITERA Logo"
            width={100}
            height={100}
            className="object-contain"
            priority
          />
        </div>

        {/* Title */}
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground text-center mb-2 tracking-tight">
          Pengumuman Hasil Seleksi
        </h1>
        <p className="text-base text-foreground/80 text-center max-w-lg mb-8 font-medium bg-background/50 px-6 py-2 rounded-full backdrop-blur-sm">
          Staff Internship PMK ITERA 2026
        </p>

        {/* Search Card */}
        <Card className="w-full bg-white shadow-xl rounded-3xl border border-border/50 p-6 md:p-8 mb-8">
          <CardContent className="p-0 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nim" className="text-foreground font-semibold text-base">
                  Nomor Induk Mahasiswa (NIM)
                </Label>
                <div className="relative">
                  <Input
                    id="nim"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    placeholder="Contoh: 126140086"
                    className="h-16 rounded-2xl bg-muted/20 border-border px-5 text-lg font-medium tracking-wide focus-visible:ring-accent focus-visible:ring-2"
                    maxLength={12}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Masukkan NIM lengkap yang digunakan saat mendaftar open recruitment.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-semibold text-base">
                  Email Pendaftaran
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: nama.12345678@student.itera.ac.id"
                    className="h-16 rounded-2xl bg-muted/20 border-border px-5 text-lg font-medium tracking-wide focus-visible:ring-accent focus-visible:ring-2"
                    autoFocus={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Masukkan email yang digunakan saat mendaftar open recruitment.
                </p>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-16 bg-accent hover:bg-accent/90 active:bg-accent text-accent-foreground font-bold rounded-2xl text-lg shadow-lg transition-all flex items-center justify-center gap-2 touch-manipulation"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" />
                    Memeriksa...
                  </span>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Cek Status Kelulusan
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Result Area */}
        {result && (
          <div className="w-full animate-fade-in space-y-6">
            {result.status === "ACCEPTED" && (
              <Card className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-2 border-emerald-500/40 shadow-2xl rounded-3xl overflow-hidden">
                <div className="bg-emerald-600 text-white px-6 py-4 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                  <h3 className="font-serif text-xl font-bold">Selamat, Kamu LOLOS!</h3>
                </div>
                <CardContent className="p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nama Pendaftar</p>
                      <h4 className="text-xl md:text-2xl font-bold text-foreground">{result.nama}</h4>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/80 border border-emerald-200 shadow-sm space-y-3">
                    <p className="text-sm font-medium text-emerald-900 leading-relaxed">
                      {result.message}
                    </p>
                  </div>

                  {result.placements && result.placements.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="font-semibold text-foreground text-sm uppercase tracking-wider text-muted-foreground">
                        Penempatan Pelayanan:
                      </h5>
                      <div className="space-y-3">
                        {result.placements.map((p, idx) => (
                          <div key={idx} className="p-4 md:p-5 rounded-2xl bg-white border border-border shadow-sm flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="space-y-1">
                                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                  {p.departemen}
                                </span>
                                <h4 className="font-serif text-lg font-bold text-foreground">{p.divisi}</h4>
                              </div>
                              {p.prodi && (
                                <span className="text-xs text-muted-foreground bg-muted/40 px-3 py-1 rounded-lg self-start sm:self-center shrink-0">
                                  {p.prodi}
                                </span>
                              )}
                            </div>

                            {p.wa_group_link && (
                              <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/50 p-3 rounded-xl">
                                <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>Grup WhatsApp Koordinasi ({p.departemen})</span>
                                </div>
                                <a
                                  href={p.wa_group_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-sm transition-all hover:shadow shrink-0 touch-manipulation w-full sm:w-auto justify-center"
                                >
                                  <span>Gabung Grup WA</span>
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/40 text-center">
                    <p className="text-xs text-muted-foreground">
                      Tuhan Yesus memberkati setiap langkah pelayananmu ke depannya. Soli Deo Gloria! 🙏
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.status === "NOT_ACCEPTED" && (
              <Card className="bg-white border border-border/80 shadow-xl rounded-3xl overflow-hidden">
                <div className="bg-amber-600 text-white px-6 py-4 flex items-center gap-3">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="font-serif text-xl font-bold">Informasi Hasil Seleksi</h3>
                </div>
                <CardContent className="p-6 md:p-8 space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-foreground">{result.nama}</h4>
                    <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
                      {result.message}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground italic">
                      &quot;Sebab aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN...&quot; — Yeremia 29:11
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.status === "NOT_REGISTERED" && (
              <Card className="bg-white border border-destructive/30 shadow-xl rounded-3xl overflow-hidden">
                <div className="bg-destructive text-destructive-foreground px-6 py-4 flex items-center gap-3">
                  <XCircle className="w-6 h-6" />
                  <h3 className="font-serif text-xl font-bold">NIM Tidak Ditemukan</h3>
                </div>
                <CardContent className="p-6 md:p-8 space-y-4 text-center">
                  <p className="text-muted-foreground leading-relaxed">
                    {result.message}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
