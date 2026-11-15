"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { putAttachment } from "@/lib/r2";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { MAX_FILE_SIZE_BYTES } from "@/lib/file-upload-limits";

const MAX_FILE_SIZE = MAX_FILE_SIZE_BYTES; // 512 KB
// F2-8: batas panjang nama file (sebelumnya tidak dibatasi). Path Storage
// maksimal 1024 char; 200 char cukup longgar dan aman.
const MAX_FILE_NAME_LENGTH = 200;
// Batasi spam tanpa menghalangi form yang membutuhkan banyak lampiran.
// Sisakan ruang untuk retry karena setiap file memakai satu request upload.
const UPLOAD_RATE_LIMIT = 30;
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
 * - formId: UUID from form.forms
 * - respondentKey: optional non-sensitive path segment; defaults to "anonymous"
 *
 * Files go to the PRIVATE R2 bucket (lib/r2.ts). The action returns the object key, which the
 * form stores as the answer; admins open it through /admin/attachments. Uploads are only accepted
 * for a form that is open right now and has at least one file_upload field, so the bucket cannot be
 * used as free storage through some other form id.
 */
export async function uploadFormAttachment(formData: FormData) {
  try {
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
      throw new Error("Ukuran file terlalu besar. Maksimum 512 KB.");
    }

    const typeError = validateFileType(file);
    if (typeError) {
      throw new Error(typeError);
    }

    // Hitung hanya upload yang lolos validasi agar file invalid tidak
    // menghabiskan kuota. Satu file tetap dihitung sebagai satu upload.
    const ip = getClientIp(await headers());
    if (await rateLimit(`upload:${ip}`, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_MS)) {
      return {
        success: false as const,
        error: "Terlalu banyak upload. Silakan tunggu beberapa saat.",
      };
    }

    const safeRespondentKey = String(respondentKey)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "anonymous";
    // F2-8: nama file dibatasi 200 char (sebelumnya tak terbatas).
    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, MAX_FILE_NAME_LENGTH);
    const supabase = createServiceClient();
    const { data: form } = await supabase
      .from("forms")
      .select("id, is_open, is_deleted, open_date, close_date, form_fields")
      .eq("id", formId)
      .maybeSingle();
    const now = Date.now();
    const acceptsFiles =
      !!form &&
      form.is_open === true &&
      form.is_deleted !== true &&
      new Date(form.open_date).getTime() <= now &&
      new Date(form.close_date).getTime() >= now &&
      Array.isArray(form.form_fields) &&
      form.form_fields.some((f: { type?: string }) => f?.type === "file_upload");
    if (!acceptsFiles) {
      throw new Error("Form tidak menerima lampiran saat ini.");
    }

    const objectKey = `${formId.toLowerCase()}/${safeRespondentKey}/${now}-${randomBytes(4).toString("hex")}-${safeFileName}`;

    try {
      await putAttachment(objectKey, new Uint8Array(await file.arrayBuffer()), file.type);
    } catch (error) {
      console.error("Form attachment upload error", error);
      throw new Error("Gagal mengunggah lampiran. Silakan coba lagi.");
    }

    return { success: true as const, key: objectKey };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengunggah lampiran.";
    return { success: false as const, error: message };
  }
}
