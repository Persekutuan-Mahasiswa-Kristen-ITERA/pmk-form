"use server";

import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadFile(formData: FormData) {
    try {
        const file = formData.get("file") as File | null;
        const recruitmentId = formData.get("recruitmentId") as string;
        const applicantNim = formData.get("applicantNim") as string;

        if (!file || !recruitmentId || !applicantNim) {
            throw new Error("Data tidak lengkap untuk upload file.");
        }

        // 1. Server-side validation
        if (file.type !== "application/pdf") {
            throw new Error("Invalid file type. Only PDF files are allowed.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("File too large. Maximum size is 5 MB.");
        }

        const supabase = await createClient();
        const fileName = `${recruitmentId}/${applicantNim}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // 2. Upload to Supabase
        const { error } = await supabase.storage
            .from("recruitment-files")
            .upload(fileName, file);

        if (error) {
            console.error("Upload error", error);
            throw new Error(`Gagal mengupload file: ${error.message}`);
        }

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from("recruitment-files")
            .getPublicUrl(fileName);

        return { success: true, url: publicUrl };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
