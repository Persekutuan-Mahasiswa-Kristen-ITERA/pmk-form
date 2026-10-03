import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFormSchema } from "@/lib/form-schema";

test("buildFormSchema: required vs optional", () => {
  const schema = buildFormSchema([
    { id: "wajib", type: "text", label: "Wajib", required: true },
    { id: "opsional", type: "text", label: "Opsional" },
  ]);
  assert.equal(schema.safeParse({ wajib: "x", opsional: null }).success, true);
  assert.equal(schema.safeParse({ wajib: "", opsional: null }).success, false);
});

test("buildFormSchema: email optional boleh kosong, required harus valid", () => {
  const schema = buildFormSchema([
    { id: "e1", type: "email", label: "E1" },
    { id: "e2", type: "email", label: "E2", required: true },
  ]);
  assert.equal(schema.safeParse({ e1: null, e2: "a@b.co" }).success, true);
  assert.equal(schema.safeParse({ e1: "bukan-email", e2: "a@b.co" }).success, false);
  assert.equal(schema.safeParse({ e1: null, e2: "" }).success, false);
});

test("buildFormSchema: validation minLength/maxLength/pattern", () => {
  const schema = buildFormSchema([
    {
      id: "kode",
      type: "text",
      label: "Kode",
      required: true,
      validation: { minLength: 3, maxLength: 5, pattern: "^[A-Z]+$" },
    },
  ]);
  assert.equal(schema.safeParse({ kode: "ABC" }).success, true);
  assert.equal(schema.safeParse({ kode: "AB" }).success, false);
  assert.equal(schema.safeParse({ kode: "ABCDEF" }).success, false);
  assert.equal(schema.safeParse({ kode: "abc" }).success, false);
});
