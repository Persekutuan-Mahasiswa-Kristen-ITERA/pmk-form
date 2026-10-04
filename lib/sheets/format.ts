/**
 * Fungsi MURNI pemformatan baris Sheets (Fase 6-3).
 *
 * Dipisah dari client.ts karena file ini TIDAK import "server-only" /
 * Google API, sehingga bisa diuji unit langsung tanpa mock.
 */

/**
 * Base REST Sheets API v4. Ditaruh di sini (bukan client.ts) supaya bisa
 * diuji regresi tanpa menyentuh "server-only".
 *
 * !!! JANGAN ubah ke host /auth/... atau /upload/... — keduanya
 * menghasilkan 404/HTML untuk endpoint values (bug fix/sheets-api-url).
 */
export const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * ESCAPE anti formula-injection.
 *
 * Sheets mode RAW sudah mencegah evaluasi formula, TAPI sebagai pertahanan
 * ganda, nilai yang berawalan karakter formula (`=`, `+`, `-`, `@`) diawali
 * tanda kutip tunggal supaya tidak ditafsirkan sebagai formula.
 */
export function escapeFormulaValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/** Versi array (untuk checkbox yang jawabannya list). */
export function flattenAnswer(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => escapeFormulaValue(v)).join(", ");
  }
  return escapeFormulaValue(value);
}

/**
 * Bangun satu baris untuk append, urutan = urutan field form.
 * Kolom terakhir SELALU `__response_id` untuk idempotensi.
 */
export function buildRow(
  fields: { id: string; label: string }[],
  answers: Record<string, unknown>,
  responseId: string
): string[] {
  const row = fields.map((f) => {
    const value = f.id in answers ? answers[f.id] : answers[f.label];
    return flattenAnswer(value);
  });
  row.push(responseId);
  return row;
}

/** Header sheet = label field + nama kolom idempotensi. */
export function buildHeader(fields: { label: string }[]): string[] {
  return [...fields.map((f) => f.label), "__response_id"];
}

/**
 * Sanitasi pesan error sebelum disimpan ke outbox.last_error.
 *
 * !!! WAJIB: TIDAK boleh memuat PII atau secret. Ambil potongan teknis
 * umum saja, buang kemungkinan token (JWT "eyJ...").
 */
export function sanitizeError(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  const noToken = trimmed.replace(/eyJ[A-Za-z0-9_.-]{10,}/g, "[token]");
  return noToken.slice(0, 250);
}

/** Hitung backoff eksponensial (menit): 1, 2, 4, 8 ... maks 60. */
export function backoffMinutes(attempts: number): number {
  return Math.min(2 ** attempts, 60);
}

/**
 * Ekstrak spreadsheet ID dari URL Google Sheets, atau terima ID mentah.
 *
 *   https://docs.google.com/spreadsheets/d/1AbC123/edit#gid=0  -> 1AbC123
 *   1AbC123                                                   -> 1AbC123
 */
export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

/**
 * Terjemahkan status + pesan error Google Sheets menjadi pesan admin yang
 * LANGSUNG bisa ditindaklanjuti (Fase 6).
 *
 * Kenapa perlu: Google memakai 403 untuk "belum di-share" DAN untuk "Sheets
 * API belum diaktifkan di project". Tanpa membedakan keduanya, admin disuruh
 * terus-menerus share spreadsheet padahal masalahnya di Google Cloud.
 *
 * Murni (tanpa network) supaya bisa diuji unit tanpa kredensial.
 */
export function describeSheetsError(
  status: number,
  googleMessage: string,
  serviceEmail: string | null
): string {
  const emailHint = serviceEmail ?? "(service account belum dikonfigurasi)";

  // "Google Sheets API has not been used in project ... or it is disabled"
  if (
    /has not been used in project|it is disabled|sheets\.googleapis\.com\/overview/i.test(
      googleMessage
    )
  ) {
    return "Google Sheets API belum diaktifkan di project service account ini. Buka Google Cloud Console project service account -> APIs & Services -> Library -> cari 'Google Sheets API' -> Enable, lalu coba lagi.";
  }
  if (status === 401) {
    return "Kredensial service account ditolak (401). Periksa GOOGLE_SERVICE_ACCOUNT_EMAIL & GOOGLE_PRIVATE_KEY (format backslash-n literal) di env Vercel, lalu redeploy.";
  }
  if (status === 403) {
    return `Spreadsheet belum bisa dibuka service account (403). Bagikan spreadsheet sebagai Editor ke: ${emailHint}. Sudah dibagikan? Pastikan email-nya persis sama, atau periksa pembatasan sharing organisasi (Google Workspace).`;
  }
  if (status === 404) {
    return `Spreadsheet tidak ditemukan atau belum di-share (404). Periksa ID/URL spreadsheet, dan pastikan sudah di-share sebagai Editor ke: ${emailHint}`;
  }
  return `Sheets API merespons HTTP ${status}.`;
}
