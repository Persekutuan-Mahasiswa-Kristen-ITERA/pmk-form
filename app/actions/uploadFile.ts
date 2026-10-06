"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
// F2-8: batas panjang nama file (sebelumnya tidak dibatasi). Path Storage
// maksimal 1024 char; 200 char cukup longgar dan aman.
const MAX_FILE_NAME_LENGTH = 200;
// F2-8: rate limit upload untuk menghambat pengisian bucket (kuota abuse).
// Lebih ketat dari submit (5/menit/IP) karena 1 file = 1 object Storage.
const UPLOAD_RATE_LIMIT = 5;
const UPLOAD_RATE_WINDOW_MS = 60_000;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
// Ekstensi yang diizinkan (cek tambahan selain MIME type, karena MIME bisa
// dipalsukan client). Harus cocok dengan allowed_mime_types bucket di migration 005.
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "doc", "docx"]);

// Fase 8-2: mapping MIME-to-extension untuk validasi konsistensi.
// Jika client mengklaim MIME = "application/pdf" tapi ekstensi .jpg, tolak.
// Ini mencegah kliker yang sengaja mengirim MIME palsu untuk bypass filter.
const MIME_TO_EXT: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
};

// Regex UUID v4 untuk memastikan formId berbentuk UUID sebelum dipakai di path.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validasi MIME-to-extension consistency dan reject extensionless files.
 * Fase 8-2: mencegah upload file dengan MIME palsu atau tanpa ekstensi.
 */
function validateFileType(file: File): string | null {
  if (!file.name.includes(".")) return "Nama file harus memiliki ekstensi.";

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return "Ekstensi file tidak didukung. Gunakan PDF, JPG, PNG, DOC, atau DOCX.";
  }

  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return "Tipe file tidak didukung. Gunakan PDF, JPG, PNG, DOC, atau DOCX.";
  }

  // Konsistensi MIME vs ekstensi (cek tambahan, Fase 8-2)
  const expectedExts = MIME_TO_EXT[file.type];
  if (expectedExts && !expectedExts.includes(extension)) {
    return "Tipe file dan ekstensi tidak cocok. Pastikan Anda mengunggah file yang benar.";
  }

  return null; // valid
}

/**
 * Upload an attachment for a generic form response.
 *
 * FormData keys:
 * - file: File
 * - formId: UUID from public.forms
 * - respondentKey: optional non-sensitive path segment; defaults to "anonymous"
 *
 * Files are stored in the generic `form-attachments` bucket. This action does
 * not inspect recruitment-specific identifiers, so surveys/presence forms can
 * use the same workflow. The bucket and policies are created in migration 001.
 */
export async function uploadFormAttachment(formData: FormData) {
  try {
    // F2-8: rate limit per IP sebelum memproses apapun (menghambat spam upload
    // yang mengisi kuota bucket). Fase 8-3: rateLimit() async + optional Upstash.
    const ip = getClientIp(await headers());
    if (await rateLimit(`upload:${ip}`, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_MS)) {
      return {
        success: false as const,
        error: "Terlalu banyak upload. Silakan tunggu beberapa saat.",
      };
    }

    const file = formData.get("file");
    const formId = formData.get("formId");
    const respondentKey = formData.get("respondentKey") || "anonymous";

    if (!(file instanceof File) || typeof formId !== "string" || !formId) {
      throw new Error("Data tidak lengkap untuk upload lampiran.");
    }

    // formId menjadi path folder storage; pastikan bentuknya UUID agar tidak
    // bisa disuntik path arbitrary (mis. "../../x").
    if (!UUID_RE.test(formId)) {
      throw new Error("ID form tidak valid.");
    }

    // Fase 8-2: validasi MIME-to-extension consistency + reject extensionless
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Ukuran file terlalu besar. Maksimum 10 MB.");
    }

    const typeError = validateFileType(file);
    if (typeError) {
      throw new Error(typeError);
    }

    const safeRespondentKey = String(respondentKey)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "anonymous";
    // F2-8: nama file dibatasi 200 char (sebelumnya tak terbatas).
    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, MAX_FILE_NAME_LENGTH);
    const objectPath = `${formId}/${safeRespondentKey}/${Date.now()}-${safeFileName}`;

    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("form-attachments")
      .upload(objectPath, file, { upsert: false });

    if (error) {
      console.error("Form attachment upload error", error);
      throw new Error(`Gagal mengunggah lampiran: ${error.message}`);
    }

    const { data } = supabase.storage
      .from("form-attachments")
      .getPublicUrl(objectPath);

    return { success: true as const, url: data.publicUrl, path: objectPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengunggah lampiran.";
    return { success: false as const, error: message };
  }
}
