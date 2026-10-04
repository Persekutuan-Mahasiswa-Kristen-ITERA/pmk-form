/**
 * Fungsi MURNI pemformatan baris Sheets (Fase 6-3).
 *
 * Dipisah dari client.ts karena file ini TIDAK import "server-only" /
 * Google API, sehingga bisa diuji unit langsung tanpa mock.
 */

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
