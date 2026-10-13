"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        // Hard navigation, bukan router.push: session sudah dihapus, dan kita
        // harus membuang snapshot RSC (client cache) supaya tombol "kembali"
        // tidak menampilkan halaman admin yang ditinggalkan setelah logout.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/admin/login";
    };

    return (
        <Button onClick={handleSignOut} variant="outline" size="sm" className="border-accent text-foreground hover:bg-highlight rounded-xl">
            <LogOut className="w-4 h-4 md:mr-2 text-destructive" />
            <span className="hidden md:inline">Keluar</span>
        </Button>
    );
}
