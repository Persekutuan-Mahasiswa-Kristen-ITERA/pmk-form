"use server";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Daftar form recruitment untuk dropdown di halaman /hasil (Cek Hasil).
 *
 * Mengapa server action + service role (bukan query client dari browser):
 *  - Policy SELECT publik pada public.forms hanya memperlihatkan form dengan
 *    is_open = true (sudah begitu sejak migration 001). Semua form produksi
 *    saat ini is_open = false, jadi query client dari browser mengembalikan
 *    DAFTAR KOSONG dan dropdown tidak pernah tampil.
 *  - /hasil harus tetap bisa melayani hasil seleksi form LAMA yang sudah
 *    ditutup, jadi daftar pilihan harus diambil tanpa pembatasan is_open.
 *  - Karena itu pengambilan dilakukan di SERVER dengan service role (bypass
 *    RLS). Hanya kolom minimal (id, title) yang dipilih dan dikirim ke client
 *    - tidak ada data responden atau field config yang bocor.
 *
 * Mengembalikan id + title untuk keperluan filter saja.
 */
export async function getRecruitmentFormOptions(): Promise<
  { id: string; title: string }[]
> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("forms")
    .select("id, title")
    .eq("form_type", "recruitment")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal memuat daftar form recruitment", error.message);
    return [];
  }

  return (data ?? []) as { id: string; title: string }[];
}
