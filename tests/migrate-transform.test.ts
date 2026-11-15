import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs helper without types
import { newKeyForOldPath, oldPathFromValue, rewriteResponse } from "../scripts/migrate/transform.mjs";
import { isAttachmentKeyForForm } from "@/lib/attachments";

const FORM = "3f2b6a1e-9c4d-4e8f-a1b2-c3d4e5f60718";
const OLD = `https://ftmtea.supabase.co/storage/v1/object/public/form-attachments/${FORM}/121140001/1761000000000-CV%20Yoel.pdf`;

test("old public URL -> bucket path", () => {
  assert.equal(oldPathFromValue(OLD), `form-attachments/${FORM}/121140001/1761000000000-CV Yoel.pdf`);
  assert.equal(
    oldPathFromValue("https://x.supabase.co/storage/v1/object/public/recruitment-files/oprec/121140001_cv.pdf"),
    "recruitment-files/oprec/121140001_cv.pdf"
  );
  assert.equal(oldPathFromValue("Yoel"), null);
  assert.equal(oldPathFromValue(null), null);
});

test("new key keeps folder and timestamp and passes the app's validator", () => {
  const key = newKeyForOldPath(oldPathFromValue(OLD), FORM, "a1b2c3d4");
  assert.equal(key, `${FORM}/121140001/1761000000000-a1b2c3d4-CV_Yoel.pdf`);
  assert.equal(isAttachmentKeyForForm(key, FORM), true);
});

test("odd paths go under migrated/ and still validate", () => {
  const key = newKeyForOldPath("recruitment-files/oprec/2025/else.pdf", FORM, "deadbeef");
  assert.match(key, new RegExp(`^${FORM}/migrated/[0-9]+-deadbeef-else.pdf$`));
  assert.equal(isAttachmentKeyForForm(key, FORM), true);
});

test("response rewrite: answers and files agree, other answers untouched", () => {
  let n = 0;
  const out = rewriteResponse(
    { answers: { f_nama: "Yoel", f_cv: OLD }, files: [OLD, "https://x.supabase.co/storage/v1/object/public/recruitment-files/a/b.pdf"] },
    ["f_cv"],
    (p: string) => newKeyForOldPath(p, FORM, String(++n).padStart(8, "0"))
  );
  assert.equal(out.answers.f_nama, "Yoel");
  assert.equal(out.answers.f_cv, out.files[0]);
  assert.equal(out.moves.length, 2);
  assert.equal(isAttachmentKeyForForm(out.files[1], FORM), true);
  assert.equal(isAttachmentKeyForForm(out.files[0], FORM), true);
});
