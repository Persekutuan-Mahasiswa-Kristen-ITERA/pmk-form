import { test } from "node:test";
import assert from "node:assert/strict";
import { isFormActive, resolveFormFields, normalizeNim, duplicateSlugCandidate } from "@/lib/forms";
import type { FieldConfig } from "@/types/forms";

test("isFormActive: hanya true bila is_open + rentang tanggal valid", () => {
  const base = { is_open: true, open_date: "2020-01-01T00:00:00Z", close_date: "2030-01-01T00:00:00Z" };
  assert.equal(isFormActive(base), true);
  assert.equal(isFormActive({ ...base, is_open: false }), false);
  assert.equal(isFormActive({ ...base, open_date: "2030-01-01T00:00:00Z" }), false);
  assert.equal(isFormActive({ ...base, close_date: "2020-01-01T00:00:00Z" }), false);
  assert.equal(isFormActive({ is_open: null, open_date: null, close_date: null }), false);
});

test("resolveFormFields: tanpa collect_identity kembalikan apa adanya", () => {
  const fields: FieldConfig[] = [{ id: "a", type: "text", label: "A" }];
  assert.deepEqual(
    resolveFormFields({ form_fields: fields, settings: {} }),
    fields
  );
});

test("resolveFormFields: suntik 4 field identitas di awal", () => {
  const out = resolveFormFields({ form_fields: [], settings: { collect_identity: true } });
  assert.deepEqual(out.map((f) => f.id), [
    "field_applicant_name",
    "field_applicant_nim",
    "field_applicant_email",
    "field_applicant_angkatan",
  ]);
  assert.equal(out[0].required, true);
});

test("resolveFormFields: tidak gandakan field identitas yang sudah ada", () => {
  const existing: FieldConfig = { id: "field_applicant_nim", type: "text", label: "NIM custom", required: false };
  const out = resolveFormFields({ form_fields: [existing], settings: { collect_identity: true } });
  const nims = out.filter((f) => f.id === "field_applicant_nim");
  assert.equal(nims.length, 1);
  assert.equal(nims[0].label, "NIM custom");
});

test("normalizeNim: konsisten trim + upper + buang non-alfanumerik", () => {
  assert.equal(normalizeNim("  a1b2-c3.d4 "), "A1B2C3D4");
  assert.equal(normalizeNim("121140001"), "121140001");
});

// Fase 7-4: logika nama slug duplikasi (dites tanpa DB).
test("duplicateSlugCandidate: urutan slug-copy, slug-copy-2, slug-copy-3", () => {
  assert.equal(duplicateSlugCandidate("oprec", 1), "oprec-copy");
  assert.equal(duplicateSlugCandidate("oprec", 2), "oprec-copy-2");
  assert.equal(duplicateSlugCandidate("oprec", 5), "oprec-copy-5");
  assert.equal(duplicateSlugCandidate("oprec", 0), "oprec-copy");
});

test("duplicateSlugCandidate: slug dengan tanda hubung tetap utuh", () => {
  assert.equal(duplicateSlugCandidate("form-panjang-1", 1), "form-panjang-1-copy");
  assert.equal(duplicateSlugCandidate("form-panjang-1", 3), "form-panjang-1-copy-3");
});
