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
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

// Pesan error aman: tidak membocorkan apakah email terdaftar di allowlist
// (keputusan 5.3). Hanya beri tahu bahwa kredensial tidak valid.
const SAFE_LOGIN_ERROR = "Email atau password salah.";
const OAUTH_ERRORS: Record<string, string> = {
  oauth_cancelled: "Login Google dibatalkan.",
  oauth_failed: "Login Google gagal. Coba lagi, atau gunakan email & password.",
  invalid_request: "Permintaan login tidak valid.",
};

export default function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const router = useRouter();
    const supabase = createClient();

    // Tampilkan pesan error dari parameter ?error (dari callback OAuth).
    useState(() => {
      if (typeof window === "undefined") return;
      const code = new URLSearchParams(window.location.search).get("error");
      if (code && OAUTH_ERRORS[code]) setErrorMsg(OAUTH_ERRORS[code]);
    });

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
                        Silakan masuk untuk mengelola Open Recruitment
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <GoogleLoginButton />

                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/60" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-muted-foreground">atau</span>
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="font-semibold">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@pmkitera.com"
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
                </CardContent>
            </Card>
        </main>
    );
}
