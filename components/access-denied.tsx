import { ShieldAlert } from "lucide-react";
import { PMKLogo } from "@/components/PMKLogo";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Halaman 403 "Akses Ditolak" untuk area admin (UI Overhaul U1).
 *
 * Dirancang untuk dipakai oleh layout/halaman admin bila `getAdminUser()`
 * mengembalikan null (user terautentikasi tetapi bukan admin). Tombol Keluar
 * tetap ada supaya user bisa keluar dan mencoba akun lain.
 *
 * Aman: tidak membocorkan rute apa pun atau alasan penolakan teknis.
 */
export function AccessDeniedCard({
  message = "Akun Anda tidak terdaftar sebagai admin. Hubungi super admin jika Anda merasa ini adalah kekeliruan.",
}: {
  message?: string;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-border bg-white p-8 text-center shadow-sm sm:p-10">
        <PMKLogo size={80} className="border-2" />

        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/5">
          <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Akses Ditolak
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>

        <SignOutButton />
      </div>
    </main>
  );
}
