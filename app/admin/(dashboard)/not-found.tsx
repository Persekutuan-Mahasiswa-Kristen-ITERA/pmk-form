import { AccessDeniedCard } from "@/components/access-denied";

/**
 * Not-found khusus area admin (UI Overhaul U1).
 *
 * Bila `/admin/*` tidak cocok route apa pun (mis. salah ketik URL admin),
 * proxy.ts sudah mengarahkan user tak login ke `/admin/login`. User yang
 * login tapi bukan admin akan melihat 403 (lebih tepat daripada 404, karena
 * memang tidak punya akses ke area admin sama sekali).
 *
 * Aman: tidak membocorkan keberadaan rute admin kepada pengguna publik —
 * halaman ini hanya bisa dicapai di bawah `/admin/` yang sudah dilindungi.
 */
export default function AdminNotFound() {
  return <AccessDeniedCard message="Halaman yang Anda cari tidak ditemukan di area admin." />;
}
