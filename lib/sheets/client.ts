import "server-only";

import { GoogleAuth } from "google-auth-library";
import {
  buildHeader,
  sanitizeError,
  SHEETS_API,
  describeSheetsError,
} from "@/lib/sheets/format";

/**
 * Klien Google Sheets (Fase 6-1).
 *
 * !!! SERVER-ONLY. Secret (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
 * hanya dibaca di sini, tidak pernah di-log, tidak pernah dikirim ke client.
 *
 * Pendekatan: SERVICE ACCOUNT (bukan OAuth per-user, bukan Apps Script).
 * Spreadsheet di-share ke email service account sebagai Editor.
 *
 * Library: `google-auth-library` saja + fetch ke REST Sheets. Dipilih daripada
 * `googleapis` (full SDK, ~500KB+) karena kita hanya butuh endpoint
 * spreadsheets.values (append/get/update). Lihat CHECKPOINT 6.2.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
// NOTE: SHEETS_API diimpor dari format.ts agar bisa diuji regresi tanpa
// menyentuh "server-only".

export interface SheetsConfig {
  spreadsheet_id: string;
  sheet_name: string;
  enabled: boolean;
}

/** Ambil konfigurasi Sheets dari form (kolom sheets_config JSONB). */
export function getSheetsConfig(form: {
  sheets_config?: unknown;
}): SheetsConfig | null {
  const cfg = form.sheets_config;
  if (!cfg || typeof cfg !== "object") return null;
  const c = cfg as Record<string, unknown>;
  if (typeof c.spreadsheet_id !== "string" || typeof c.sheet_name !== "string") {
    return null;
  }
  return {
    spreadsheet_id: c.spreadsheet_id,
    sheet_name: c.sheet_name,
    enabled: c.enabled === true,
  };
}

/**
 * Ambil access token JWT service account. Token di-cache otomatis oleh
 * GoogleAuth (refresh sebelum kedaluwarsa).
 *
 * !!! JANGAN pernah return/log token. Hanya dipakai untuk header Authorization.
 */
async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Private key di .env disimpan dengan \n literal; konversi ke newline asli.
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Kredensial service account Google belum dikonfigurasi (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)."
    );
  }

  try {
    const auth = new GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: SCOPES,
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error("Access token kosong.");
    return token.token;
  } catch (err) {
    // Bungkus dengan penanda biar testConnection bisa membedakannya dari
    // kegagalan jaringan/HTTP (pesan ini hanya untuk admin, tanpa PII).
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Kredensial service account ditolak Google. Periksa GOOGLE_PRIVATE_KEY (format backslash-n literal) & email di env, lalu redeploy. Detail: ${detail.slice(0, 160)}`
    );
  }
}

// Fungsi murni (escape/build/sanitize) tinggal di format.ts agar bisa
// diuji unit tanpa memerlukan kredensial Google. Diekspor ulang di sini
// supaya pemanggil lama tetap bisa.
export {
  buildHeader,
  buildRow,
  escapeFormulaValue,
  flattenAnswer,
  sanitizeError,
} from "@/lib/sheets/format";

// NOTE: re-export SHEETS_API ada di bawah file (blok export).

/**
 * Cek apakah response_id sudah ada di sheet (IDEMPOTENSI).
 *
 * Baca kolom __response_id (kolom terakhir). Saat retry, jika id sudah ada,
 * append DILEWATI — tidak ada baris ganda.
 */
export async function rowExists(
  spreadsheetId: string,
  sheetName: string,
  responseId: string
): Promise<boolean> {
  const token = await getAccessToken();
  const range = encodeURIComponent(`${sheetName}!__response_id`);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${range}?majorDimension=COLUMNS`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    // Range belum ada (sheet masih kosong / header belum dibuat) -> belum ada.
    if (res.status === 400 || res.status === 404) return false;
    throw new Error(`Sheets get gagal: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  const ids = (data.values ?? []).flat();
  return ids.includes(responseId);
}

/**
 * Tulis (atau perbarui) header sheet. Dipanggil sebelum append pertama kali
 * dan saat field form berubah (header = label field saat ini).
 *
 * Aturan perubahan form (Fase 6-3):
 *   - field ditambah -> kolom baru muncul di kanan (header ditulis ulang).
 *   - field dihapus   -> kolom lama DIPERTAHANKAN (data lama tidak rusak).
 *   - field di-rename -> hanya header diperbarui.
 */
export async function ensureHeader(
  spreadsheetId: string,
  sheetName: string,
  fields: { label: string }[]
): Promise<void> {
  const token = await getAccessToken();
  const header = buildHeader(fields);
  const range = encodeURIComponent(`${sheetName}!A1`);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [header] }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`Sheets header gagal: HTTP ${res.status} ${sanitizeError(body)}`);
  }
}

/**
 * Append batch baris ke sheet. Mode RAW + escape formula.
 *
 * @returns jumlah baris yang benar-benar ditulis (0 bila semua sudah ada).
 */
export async function appendRows(
  spreadsheetId: string,
  sheetName: string,
  rows: string[][]
): Promise<number> {
  if (rows.length === 0) return 0;
  const token = await getAccessToken();
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`Sheets append gagal: HTTP ${res.status} ${sanitizeError(body)}`);
  }
  return rows.length;
}

/**
 * Tes koneksi: pastikan spreadsheet bisa dibuka oleh service account.
 *
 * @returns pesan status yang aman ditampilkan ke admin (tanpa bocor URL
 *          spreadsheet bila gagal).
 */
export async function testConnection(
  spreadsheetId: string,
  sheetName: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await getAccessToken();
    const metaUrl = `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`;
    const res = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      // Baca pesan error Google dulu: 403 bisa berarti "belum di-share"
      // ATAU "Sheets API belum diaktifkan di project" — keduanya harus dibedakan.
      let googleMessage = "";
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        googleMessage = body.error?.message ?? "";
      } catch {
        // Bukan JSON (mis. halaman HTML 404 lama) -> pesan kosong cukup.
      }
      return {
        ok: false,
        message: describeSheetsError(
          res.status,
          googleMessage,
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null
        ),
      };
    }

    const meta = (await res.json()) as {
      sheets?: { properties: { title: string } }[];
    };
    const titles = (meta.sheets ?? []).map((s) => s.properties.title);
    if (!titles.includes(sheetName)) {
      return {
        ok: false,
        message: `Sheet "${sheetName}" tidak ditemukan. Sheet yang tersedia: ${titles.join(", ") || "(kosong)"}.`,
      };
    }
    return { ok: true, message: `Terhubung. Sheet "${sheetName}" siap.` };
  } catch (err) {
    // Kredensial salah format/email -> pesan dari getAccessToken (mengandung
    // penanda "Kredensial service account"). Lainnya anggap gagal jaringan.
    return {
      ok: false,
      message:
        err instanceof Error && /Kredensial service account/.test(err.message)
          ? err.message
          : "Gagal terhubung ke Google Sheets (cek env / jaringan). Coba lagi nanti.",
    };
  }
}

export { SHEETS_API, SCOPES };
