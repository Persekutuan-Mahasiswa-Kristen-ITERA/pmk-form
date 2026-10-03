"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PMK_LOGO_URL } from "@/components/PMKLogo";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
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
            setErrorMsg(error.message);
            setLoading(false);
        } else {
            router.push("/admin/dashboard");
            router.refresh();
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-[#FAF6F0] p-4 relative overflow-hidden">
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
                    <CardTitle className="font-serif text-2xl text-foreground font-bold">Admin Portal</CardTitle>
                    <CardDescription className="text-center font-medium mt-2">
                        Silakan masuk untuk mengelola Open Recruitment
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
