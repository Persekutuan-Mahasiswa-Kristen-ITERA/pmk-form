"use server";

import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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
// Regex UUID v4 untuk memastikan formId berbentuk UUID sebelum dipakai di path.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      throw new Error("Tipe file tidak didukung. Gunakan PDF, JPG, PNG, DOC, atau DOCX.");
    }

    // Ekstensi nama file diperiksa terpisah dari MIME karena client bisa
    // mengirim MIME palsu dengan ekstensi berbeda.
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error("Ekstensi file tidak didukung. Gunakan PDF, JPG, PNG, DOC, atau DOCX.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Ukuran file terlalu besar. Maksimum 10 MB.");
    }

    const safeRespondentKey = String(respondentKey)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "anonymous";
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
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

/**
 * Compatibility action for the active recruitment flow.
 *
 * Keep this untouched semantically until Phase 5 switches the public renderer
 * to forms/form_responses. Existing open recruitments therefore keep uploading
 * to their current bucket and cannot be disrupted by the platform migration.
 */
export async function uploadFile(formData: FormData) {
  try {
    const file = formData.get("file");
    const recruitmentId = formData.get("recruitmentId");
    const applicantNim = formData.get("applicantNim");

    if (!(file instanceof File) || typeof recruitmentId !== "string" || typeof applicantNim !== "string" || !recruitmentId || !applicantNim) {
      throw new Error("Data tidak lengkap untuk upload file.");
    }

    if (file.type !== "application/pdf") {
      throw new Error("Invalid file type. Only PDF files are allowed.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File too large. Maximum size is 5 MB.");
    }

    const supabase = await createClient();
    const fileName = `${recruitmentId}/${applicantNim}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("recruitment-files").upload(fileName, file);

    if (error) {
      console.error("Recruitment file upload error", error);
      throw new Error(`Gagal mengupload file: ${error.message}`);
    }

    const { data } = supabase.storage.from("recruitment-files").getPublicUrl(fileName);
    return { success: true as const, url: data.publicUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengupload file.";
    return { success: false as const, error: message };
  }
}
