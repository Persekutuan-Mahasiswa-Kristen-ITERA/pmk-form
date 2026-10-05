import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Form,
  FormResponse,
  FormResponseInput,
  FormType,
  FieldConfig,
  FormSettings,
} from "@/types/forms";

// ==========================================
// FORMS — CRUD service
// ==========================================

/**
 * Definisi tunggal "form aktif" (Fase 2-4).
 *
 * Sebuah form AKTIF (tampil di landing & dihitung di statistik) jika dan hanya
 * jika: `is_open = true` DAN `open_date <= now()` DAN `close_date > now()`.
 *
 * `open_date`/`close_date` NOT NULL menurut schema produksi (migration 001),
 * tapi tetap dijaga defensif untuk data luar/migrasi parsial.
 *
 * Satu helper ini dipakai bersama oleh: landing page, dashboard admin, dan
 * `countActiveForms()`. Jangan menulis definisi sebanding di tempat lain.
 */
export function isFormActive(form: {
  is_open: boolean | null;
  open_date: string | null;
  close_date: string | null;
}): boolean {
  if (!form.is_open) return false;
  const now = Date.now();
  if (form.open_date && new Date(form.open_date).getTime() > now) return false;
  if (form.close_date && new Date(form.close_date).getTime() <= now) return false;
  return true;
}

/**
 * Field identitas otomatis (Fase 3-2a).
 *
 * `settings.collect_identity` ditawarkan builder sebagai toggle "Kumpulkan
 * Identitas Otomatis (Nama/NIM/Email/Prodi)" tetapi sebelumnya TIDAK
 * diimplementasikan di renderer/server — form yang aktif toggle-nya tidak
 * mengumpulkan identitas apa pun. 7 dari 8 form produksi memakainya.
 *
 * Field disuntikkan dengan id STABIL (bukan label) supaya:
 *  - pengecekan duplikat NIM di submitResponse (`field_applicant_nim`) cocok,
 *  - pengecekan identitas (mis. NIM/nama/email) konsisten lintas form dan
 *    mudah dipakai untuk filter status di admin (Fase 7-3).
 *    (sama seperti data pra-migrasi).
 *
 * Field yang sudah dideklasikan di form TIDAK digandakan: jika form sudah punya
 * field dengan id yang sama, yang ada dipakai (admin bebas mengaturnya).
 */
const IDENTITY_FIELD_IDS = {
  name: "field_applicant_name",
  nim: "field_applicant_nim",
  email: "field_applicant_email",
  angkatan: "field_applicant_angkatan",
} as const;

/**
 * Selesaikan field form yang akan dirender/divalidasi, termasuk menyuntikkan
 * field identitas otomatis saat `settings.collect_identity` true.
 *
 * SATU sumber kebenaran ini dipakai OLEH RENDERER (via getFormBySlug) DAN
 * server action submit — keduanya melihat field yang sama, jadi validasi
 * server tidak bisa dilewati dan UI tidak bisa menyembunyikan field wajib.
 */
export function resolveFormFields(form: {
  form_fields?: FieldConfig[] | null;
  settings?: FormSettings | null;
}): FieldConfig[] {
  const fields = (form.form_fields ?? []) as FieldConfig[];
  const settings = (form.settings ?? {}) as FormSettings;

  if (!settings.collect_identity) return fields;

  const existing = new Set(fields.map((f) => f.id));
  const injected: FieldConfig[] = [];

  const identityFields: FieldConfig[] = [
    { id: IDENTITY_FIELD_IDS.name, type: "text", label: "Nama Lengkap", required: true },
    { id: IDENTITY_FIELD_IDS.nim, type: "text", label: "NIM", required: true },
    { id: IDENTITY_FIELD_IDS.email, type: "email", label: "Email", required: true },
    {
      id: IDENTITY_FIELD_IDS.angkatan,
      type: "text",
      label: "Angkatan",
      required: false,
      placeholder: "contoh: 2023",
    },
  ];

  for (const f of identityFields) {
    if (!existing.has(f.id)) injected.push(f);
  }

  // Identitas disisipkan di AWAL (paling atas form) agar urutan alami.
  return [...injected, ...fields];
}

/**
 * Terapkan filter "form aktif" ke sebuah query builder Supabase pada `forms`.
 *
 * CATATAN: supabase-js memakai tipe builder yang sangat dalam; membungkusnya
 * dengan generic sendiri memicu "Type instantiation is excessively deep".
 * Karena itu filter diaplikasikan inline di tiap pemanggilan, dan `isFormActive`
 * di atas jadi definisi kanonik yang harus dijaga konsisten.
 */

/** Fetch all open forms for the public landing page. */
export async function getOpenForms(options?: {
  formType?: FormType;
}): Promise<Form[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Filter ini harus konsisten dengan isFormActive().
  let query = supabase
    .from("forms")
    .select("*")
    .eq("is_open", true)
    .lte("open_date", now)
    .gt("close_date", now);

  if (options?.formType) {
    query = query.eq("form_type", options.formType);
  }
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat form: ${error.message}`);
  return (data ?? []) as Form[];
}

/** Count active forms for the public landing stats (RLS-safe, no admin needed). */
export async function countOpenForms(): Promise<number> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Filter ini harus konsisten dengan isFormActive().
  const { count, error } = await supabase
    .from("forms")
    .select("id", { count: "exact", head: true })
    .eq("is_open", true)
    .lte("open_date", now)
    .gt("close_date", now);

  if (error) throw new Error(`Gagal menghitung form aktif: ${error.message}`);
  return count ?? 0;
}

/** Fetch a single form by slug (public). */
export async function getFormBySlug(slug: string): Promise<Form | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(`Gagal memuat form: ${error.message}`);
  }

  // Fase 3-2a: suntikkan field identitas otomatis bila collect_identity aktif.
  // resolveFormFields adalah sumber kebenaran bersama renderer & server action.
  return { ...data, form_fields: resolveFormFields(data) } as Form;
}

/** Fetch a single form by id (admin). */
export async function getFormById(id: string): Promise<Form | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Gagal memuat form: ${error.message}`);
  }
  return data as Form;
}

/** Fetch all forms (admin dashboard). */
export async function getAllForms(options?: {
  formType?: FormType;
  page?: number;
  pageSize?: number;
}): Promise<{ data: Form[]; count: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("forms")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (options?.formType) {
    query = query.eq("form_type", options.formType);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Gagal memuat daftar form: ${error.message}`);
  return { data: (data ?? []) as Form[], count: count ?? 0 };
}

/** Count active (open) forms — for admin dashboard stats. */
export async function countActiveForms(): Promise<number> {
  await requireAdmin();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("forms")
    .select("id", { count: "exact", head: true })
    .eq("is_open", true);

  if (error) throw new Error(`Gagal menghitung form aktif: ${error.message}`);
  return count ?? 0;
}

/** Create a new form (admin). Returns the new row. */
export async function createForm(
  payload: Omit<Form, "id" | "created_at" | "updated_at">
): Promise<Form> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Gagal membuat form: ${error.message}`);
  return data as Form;
}

/** Update an existing form (admin). */
export async function updateForm(
  id: string,
  payload: Partial<Omit<Form, "id" | "created_at">>
): Promise<Form> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forms")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Gagal mengupdate form: ${error.message}`);
  return data as Form;
}

/** Toggle is_open (admin). */
export async function toggleFormOpen(
  id: string,
  isOpen: boolean
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("forms")
    .update({ is_open: isOpen, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Gagal mengubah status form: ${error.message}`);
}

/**
 * Hapus form (admin) — AMAN (Fase 4C).
 *
 * Default strategis: form yang SUDAH MEMILIKI respons TIDAK BOLEH dihapus
 * (hard-delete akan menghilangkan data + memutus riwayat status). Penghapusan
 * hanya diizinkan bila form BELUM punya respons sama sekali. Untuk menutup
 * form yang sudah berjalan, pakai `toggleFormOpen(id, false)` — buka/tutup
 * tanpa menghilangkan data.
 *
 * Penghitungan memakai head-count (tidak memuat baris respons).
 */
export async function deleteForm(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id);

  if (countError) {
    throw new Error(`Gagal memeriksa respons form: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      `Form ini memiliki ${count} respons dan tidak dapat dihapus. ` +
        "Tutup form (toggle) sebagai gantinya agar data tetap terjaga."
    );
  }

  const { error } = await supabase.from("forms").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus form: ${error.message}`);
}

// ==========================================
// FORM RESPONSES — CRUD service
// ==========================================

/** Submit a new form response (public). */
export async function submitFormResponse(
  input: FormResponseInput
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_responses")
    .insert({
      form_id: input.form_id,
      answers: input.answers,
      files: input.files ?? [],
      respondent_id: input.respondent_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Gagal menyimpan respons: ${error.message}`);
  return { id: data.id };
}

/** Get paginated responses for a form (admin). */
export async function getFormResponses(
  formId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{ data: FormResponse[]; count: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("form_responses")
    .select("*", { count: "exact" })
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Gagal memuat respons: ${error.message}`);
  return { data: (data ?? []) as FormResponse[], count: count ?? 0 };
}

/** Get ALL responses for a form (used for CSV/ZIP export). */
export async function getAllFormResponses(
  formId: string
): Promise<FormResponse[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_responses")
    .select("*")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(`Gagal mengambil semua respons: ${error.message}`);
  return (data ?? []) as FormResponse[];
}

/** Count responses for a form. */
export async function countFormResponses(formId: string): Promise<number> {
  await requireAdmin();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);

  if (error) throw new Error(`Gagal menghitung respons: ${error.message}`);
  return count ?? 0;
}

/**
 * Check for a duplicate response using a specific field value.
 * Useful for preventing the same NIM from submitting twice.
 *
 * An optional `client` can be supplied when the caller already holds a client
 * (e.g. the submission server action, which uses the service-role client so
 * that the check works for anonymous submitters too).
 */
export async function checkDuplicateResponse(
  formId: string,
  fieldId: string,
  value: string,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const { count, error } = await supabase
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId)
    .contains("answers", { [fieldId]: value });

  if (error) return false; // fail-open for now; prevent blocking a real submission
  return (count ?? 0) > 0;
}

/** Delete a single response (admin). */
export async function deleteFormResponse(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_responses")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Gagal menghapus respons: ${error.message}`);
}

// ==========================================
// USER ROLES — service
// ==========================================
// Fase 5: service layer role legacy dihapus. Sumber kebenaran otorisasi
// sekarang admin_members (migration 009); manajemen admin ada di
// app/actions/adminMembers.ts + halaman /admin/users.

/**
 * Normalisasi NIM (Fase 3-5).
  *
  * Normalisasi yang sama dipakai saat (a) mengecek duplikat aplikasi dan
  * (b) mengisi kolom `nim_normalized` untuk unique PARTIAL index (migration
  * 008). Konsistensi ini WAJIB — bila tidak, index tidak akan menangkap
  * "a1b2" vs "A1B2".
  *
  * Aturan: trim → uppercase → hapus spasi → hapus karakter non-alfanumerik.
  */
export function normalizeNim(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}
