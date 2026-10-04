import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeFormulaValue,
  flattenAnswer,
  buildRow,
  buildHeader,
  sanitizeError,
  backoffMinutes,
  parseSpreadsheetId,
} from "@/lib/sheets/format";
// SHEETS_API tinggal di format.ts (bukan client.ts yang "server-only")
// supaya bisa diuji regresi tanpa memicu error server-only.
import { SHEETS_API } from "@/lib/sheets/format";

/**
 * Tes unit Fase 6-6 (Sheets API asli TIDAK disentuh — hanya fungsi murni).
 *
 * Mencakup: mapping baris, escape formula-injection, idempotensi
 * (kolom __response_id), backoff, dan sanitasi error tanpa PII/secret.
 */

// --- regresi URL API (bug fix/sheets-api-url) ---

test("SHEETS_API: base REST v4 yang valid (bukan /auth/... atau /upload/...)", () => {
  assert.equal(SHEETS_API, "https://sheets.googleapis.com/v4/spreadsheets");
  assert.ok(!SHEETS_API.includes("/auth"), "tidak boleh memuat /auth");
  assert.ok(!SHEETS_API.includes("/upload"), "tidak boleh memuat /upload");
});

// --- escape formula injection (RAW + pertahanan ganda) ---

test("escapeFormulaValue: nilai diawali = + - @ diawali kutip tunggal", () => {
  assert.equal(escapeFormulaValue("=SUM(A1:A5)"), "'=SUM(A1:A5)");
  assert.equal(escapeFormulaValue("+cmd|'/c calc'"), "'+cmd|'/c calc'");
  assert.equal(escapeFormulaValue("-2+3"), "'-2+3");
  assert.equal(escapeFormulaValue("@malicious"), "'@malicious");
});

test("escapeFormulaValue: nilai normal tidak berubah", () => {
  assert.equal(escapeFormulaValue("Budi Santoso"), "Budi Santoso");
  assert.equal(escapeFormulaValue("12345678"), "12345678");
  assert.equal(escapeFormulaValue(""), "");
  assert.equal(escapeFormulaValue(null), "");
  assert.equal(escapeFormulaValue(undefined), "");
  // '=' di tengah aman — hanya awalan yang berbahaya.
  assert.equal(escapeFormulaValue("a=b"), "a=b");
});

// --- flatten jawaban array (checkbox) ---

test("flattenAnswer: array digabung koma, tiap elemen di-escape", () => {
  assert.equal(flattenAnswer(["A", "B", "C"]), "A, B, C");
  assert.equal(flattenAnswer(["=jahat", "normal"]), "'=jahat, normal");
  assert.equal(flattenAnswer([]), "");
  assert.equal(flattenAnswer("tunggal"), "tunggal");
});

// --- mapping baris: key id dulu, fallback label (resolveAnswer) ---

test("buildRow: urutan = urutan field, key id diutamakan", () => {
  const fields = [
    { id: "field_applicant_nim", label: "NIM" },
    { id: "field_applicant_name", label: "Nama Lengkap" },
  ];
  const answers = { field_applicant_nim: "123", field_applicant_name: "Budi" };
  assert.deepEqual(buildRow(fields, answers, "resp-1"), ["123", "Budi", "resp-1"]);
});

test("buildRow: data lama ber-key label tetap terbaca (fallback label)", () => {
  const fields = [
    { id: "field_applicant_nim", label: "NIM" },
    { id: "field_applicant_name", label: "Nama Lengkap" },
  ];
  // Respons lama ~62 baris memakai label sebagai key.
  const answers = { NIM: "123", "Nama Lengkap": "Budi" };
  assert.deepEqual(buildRow(fields, answers, "resp-2"), ["123", "Budi", "resp-2"]);
});

test("buildRow: jawaban hilang menjadi sel kosong (bukan 'undefined')", () => {
  const fields = [{ id: "a", label: "A" }];
  assert.deepEqual(buildRow(fields, {}, "resp-3"), ["", "resp-3"]);
});

test("buildRow: kolom TERAKHIR selalu __response_id (idempotensi)", () => {
  const fields = [{ id: "a", label: "A" }];
  const row = buildRow(fields, { a: "x" }, "uuid-unik-123");
  assert.equal(row[row.length - 1], "uuid-unik-123");
});

// --- header ---

test("buildHeader: header = label field + __response_id", () => {
  assert.deepEqual(buildHeader([{ label: "NIM" }, { label: "Nama Lengkap" }]), [
    "NIM",
    "Nama Lengkap",
    "__response_id",
  ]);
});

// --- sanitasi error (tanpa PII/secret) ---

test("sanitizeError: token JWT dibuang, dipotong 250 char", () => {
  const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dummy";
  const out = sanitizeError(`Sheets API 401: invalid ${jwt} secret`);
  assert.ok(!out.includes("eyJ"), "token tidak boleh lolos");
  assert.ok(out.length <= 250, "dipotong 250 char");
});

test("sanitizeError: whitespace dirapatkan", () => {
  assert.equal(sanitizeError("a\n\n  b\t c"), "a b c");
});

// --- backoff eksponensial ---

test("backoffMinutes: 1,2,4,8 lalu dibatasi 60", () => {
  assert.equal(backoffMinutes(0), 1);
  assert.equal(backoffMinutes(1), 2);
  assert.equal(backoffMinutes(2), 4);
  assert.equal(backoffMinutes(3), 8);
  assert.equal(backoffMinutes(10), 60);
  assert.equal(backoffMinutes(100), 60);
});

// --- parse spreadsheet ID ---

test("parseSpreadsheetId: ekstrak dari URL atau terima ID mentah", () => {
  assert.equal(
    parseSpreadsheetId("https://docs.google.com/spreadsheets/d/1AbC123_xyz/edit#gid=0"),
    "1AbC123_xyz"
  );
  assert.equal(parseSpreadsheetId("1AbC123_xyz"), "1AbC123_xyz");
  assert.equal(parseSpreadsheetId("  1AbC123  "), "1AbC123");
});
