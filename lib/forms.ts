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
  // Soft delete (Fase 7-6): form yang di-soft-delete tidak muncul di landing.
  // Jangan gunakan select("*") pada endpoint publik. Selain mengirim field
  // yang memang dibutuhkan renderer, itu juga membocorkan konfigurasi internal
  // (mis. spreadsheet_id) ke setiap pengunjung melalui PostgREST/RSC.
  let query = supabase
    .from("forms")
    .select("id, title, description, slug, form_type, is_open, open_date, close_date, form_fields, settings, created_at, updated_at, is_deleted, deleted_at")
    .eq("is_deleted", false)
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
  // Soft delete (Fase 7-6): exclude form yang di-soft-delete.
  const { count, error } = await supabase
    .from("forms")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false)
    .eq("is_open", true)
    .lte("open_date", now)
    .gt("close_date", now);

  if (error) throw new Error(`Gagal menghitung form aktif: ${error.message}`);
  return count ?? 0;
}

/** Fetch a single form by slug (public). */
export async function getFormBySlug(slug: string): Promise<Form | null> {
  const supabase = await createClient();
  // Public form data must be an explicit allow-list. In particular, never
  // expose sheets_config or created_by to anonymous visitors.
  const { data, error } = await supabase
    .from("forms")
    .select("id, title, description, slug, form_type, is_open, open_date, close_date, form_fields, settings, created_at, updated_at, is_deleted, deleted_at")
    .eq("slug", slug)
    .eq("is_deleted", false)
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
    .eq("is_deleted", false)
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
  includeDeleted?: boolean; // Fase 7-6: true untuk halaman sampah
}): Promise<{ data: Form[]; count: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Soft delete (Fase 7-6): dashboard default hanya tampilkan form yang
  // belum dihapus. Opsi includeDeleted untuk halaman sampah.
  let query = supabase
    .from("forms")
    .select("*", { count: "exact" })
    .eq("is_deleted", options?.includeDeleted ?? false)
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
  // Soft delete (Fase 7-6): exclude form yang di-soft-delete.
  const { count, error } = await supabase
    .from("forms")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false)
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
 * Hapus form (admin) — Fase 4C + Fase 7-6 (soft delete).
 *
 * Perilaku:
 *  - Form PUNYA respons -> SOFT DELETE: tandai is_deleted=true, sembunyikan
 *    dari dashboard + landing. Data + respons + riwayat status tetap utuh.
 *    Ini yang sebelumnya DITOLAK total (Fase 4C); sekarang bisa dihapus
 *    dengan aman tanpa kehilangan data.
 *  - Form KOSONG (0 respons) -> HARD DELETE: benar-benar dihapus (tidak ada
 *    data yang hilang). Sama seperti Fase 4C.
 *
 * !!! Pertahanan: hard delete hanya bila 0 respons. Cek via head-count.
 */
export async function deleteForm(id: string): Promise<{ softDeleted: boolean }> {
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
    // Soft delete: sembunyikan, data tetap utuh.
    const { error } = await supabase
      .from("forms")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(`Gagal menghapus form: ${error.message}`);
    return { softDeleted: true };
  }

  // Hard delete bila kosong (tidak ada data yang hilang).
  const { error } = await supabase.from("forms").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus form: ${error.message}`);
  return { softDeleted: false };
}

/**
 * Kembalikan form dari soft delete (admin) — Fase 7-6.
 *
 * Hanya untuk form yang is_deleted=true. Membatalkan tanda penghapusan,
 * form muncul lagi di dashboard (is_open tetap apa adanya — bila ditutup
 * sebelum dihapus, tetap ditutup setelah dikembalikan).
 */
export async function restoreForm(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("forms")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", id)
    .eq("is_deleted", true);

  if (error) throw new Error(`Gagal mengembalikan form: ${error.message}`);
}

/**
 * Nama kandidat slug untuk duplikasi form (Fase 7-4).
 *
 * Dipisah dari duplicateForm supaya logika unik-bisa-dites tanpa DB:
 * `slug-copy` -> `slug-copy-2` -> `slug-copy-3` ...
 */
export function duplicateSlugCandidate(sourceSlug: string, attempt: number): string {
  if (attempt <= 1) return `${sourceSlug}-copy`;
  return `${sourceSlug}-copy-${attempt}`;
}

/**
 * Duplikasi form (admin) — Fase 7 item 4.
 *
 * Salin konfigurasi form (judul, deskripsi, tipe, fields, settings,
 * sheets_config) ke form BARU. HANYA konfigurasi — respons TIDAK disalin
 * (form hasil duplikasi selalu kosong, jadi aman dihapus bila salah).
 *
 * Yang TIDAK disalin (sengaja):
 *  - id, created_at, updated_at, created_by -> dibuat baru oleh DB.
 *  - is_open -> SELALU false. Duplikat harus dibuka manual setelah diperiksa
 *    (mencegah form belum diperiksa tiba-tiba publik + landings tak terduga).
 *  - form_responses -> lihat atas.
 *
 * Slug: dibuat unik otomatis dari slug sumber (`slug-copy`, `slug-copy-2`,
 * ...) karena kolom `slug` UNIQUE. Fungsi ini mencari slot pertama yang bebas.
 */
export async function duplicateForm(sourceId: string): Promise<Form> {
  await requireAdmin();

  const supabase = await createClient();

  // Ambil form sumber lengkap (termasuk sheets_config hasil migration 010).
  const { data: source, error: fetchError } = await supabase
    .from("forms")
    .select(
      "title, description, slug, form_type, open_date, close_date, form_fields, settings, sheets_config"
    )
    .eq("id", sourceId)
    .maybeSingle();

  if (fetchError) throw new Error(`Gagal mengambil form: ${fetchError.message}`);
  if (!source) throw new Error("Form tidak ditemukan.");

  // Cari slug unik: slug-copy, slug-copy-2, ... (slug UNIQUE constraint).
  let candidateSlug = duplicateSlugCandidate(source.slug, 1);
  let attempt = 2;
  for (;;) {
    const { data: existing } = await supabase
      .from("forms")
      .select("id")
      .eq("slug", candidateSlug)
      .maybeSingle();

    if (!existing) break;
    candidateSlug = duplicateSlugCandidate(source.slug, attempt);
    attempt += 1;
  }

  const { data, error } = await supabase
    .from("forms")
    .insert({
      title: `${source.title} (Salinan)`,
      description: source.description,
      slug: candidateSlug,
      form_type: source.form_type,
      // Duplikat selalu ditutup sampai diperiksa admin (lihat docstring).
      is_open: false,
      open_date: source.open_date,
      close_date: source.close_date,
      form_fields: source.form_fields ?? [],
      settings: source.settings ?? {},
      // sheets_config disalin? Ya: admin sudah mengatur spreadsheet untuk
      // form serupa. Tapi spreadsheetnya SAMA — respons 2 form akan menulis
      // ke 1 sheet. Itu biasanya TIDAK diinginkan, jadi kita KOSONGKAN
      // duplikat (admin atur sendiri di panel Sheets). Aman default.
      sheets_config: null,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menduplikasi form: ${error.message}`);
  return data as Form;
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

/** Count responses for a single form. */
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
 * Count responses for MULTIPLE forms — single grouped query.
 *
 * Sebelumnya: `.select("form_id", { head: true, count: "exact" })` — BUG:
 * `head: true` mengembalikan BUKAN row (data selalu null), sehingga semua
 * form menampilkan "0 Respons" walau sebenarnya ada.
 *
 * Sekarang: ambil kolom `form_id` saja (tanpa head), group di JS.
 * Ini ringan — Supabase hanya mengirim 1 kolom string per row.
 */
export async function countResponsesForForms(formIds: string[]): Promise<Record<string, number>> {
  await requireAdmin();
  if (formIds.length === 0) return {};
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("form_responses")
    .select("form_id")
    .in("form_id", formIds);

  if (error) {
    // Fallback: return zeros so the page still renders
    return Object.fromEntries(formIds.map((id) => [id, 0]));
  }

  const counts: Record<string, number> = Object.fromEntries(formIds.map((id) => [id, 0]));
  if (data) {
    for (const row of data) {
      const fid = row.form_id;
      if (fid && fid in counts) {
        counts[fid] += 1;
      }
    }
  }
  return counts;
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

  // A database error must not silently turn the duplicate check into an
  // allow-list. The caller will return a generic retryable error instead.
  if (error) throw new Error("Gagal memeriksa respons sebelumnya.");
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
