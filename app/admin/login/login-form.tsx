"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PMK_LOGO_URL } from "@/components/PMKLogo";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { PICORE_URL } from "@/lib/picore";

// Pesan error aman: tidak membocorkan apakah email terdaftar (keputusan 5.3).
const SAFE_LOGIN_ERROR = "Email atau password salah.";

export default function AdminLoginForm({ googleError }: { googleError?: string }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(googleError ?? "");
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(SAFE_LOGIN_ERROR);
            setLoading(false);
        } else {
            router.push("/admin/dashboard");
            router.refresh();
        }
    };

    return (
        <main className="flex min-h-dvh items-center justify-center bg-[#FAF6F0] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <svg width="800" height="800" viewBox="0 0 24 24" fill="none" stroke="#A0522D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M5 8h14" />
                </svg>
            </div>

            <Card className="w-full max-w-sm bg-white border-t-8 border-t-accent shadow-2xl rounded-3xl relative z-10">
                <CardHeader className="flex flex-col items-center pt-10 pb-6">
                    <div className="bg-primary/5 p-4 rounded-full mb-4">
                        <Image src={PMK_LOGO_URL} alt="PMK Logo" width={80} height={80} priority />
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-foreground">Admin Portal</h1>
                    <CardDescription className="text-center font-medium mt-2">
                        Masuk dengan akun PI-CORE Anda
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="font-semibold">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="email akun PI-CORE"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="rounded-xl bg-[#FAF6F0]/50 border-accent/30 focus-visible:ring-accent"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="font-semibold">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="rounded-xl bg-[#FAF6F0]/50 border-accent/30 focus-visible:ring-accent"
                            />
                        </div>

                        {errorMsg && (
                            <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-xl border border-destructive/20 text-center">
                                {errorMsg}
                            </div>
                        )}

                        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl py-6 text-base shadow-md transition-transform hover:scale-[1.02]" disabled={loading}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Masuk"}
                        </Button>
                    </form>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
                        <span className="h-px flex-1 bg-accent/20" />
                        atau
                        <span className="h-px flex-1 bg-accent/20" />
                    </div>
                    <a
                        href="/auth/google"
                        className="flex w-full items-center justify-center gap-3 rounded-xl border border-accent/30 bg-white py-3 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-[#FAF6F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                        </svg>
                        Masuk dengan Google
                    </a>
                    <p className="text-center text-xs leading-relaxed text-muted-foreground">
                        Akun dan password dikelola di PI-CORE.{" "}
                        <a
                            href={PICORE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-primary underline underline-offset-2"
                        >
                            Lupa password atau belum punya akun?
                        </a>
                    </p>
                </CardContent>
            </Card>
        </main>
    );
}
