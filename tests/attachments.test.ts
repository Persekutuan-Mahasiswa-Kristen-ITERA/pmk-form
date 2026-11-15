import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attachmentFileName,
  attachmentPath,
  attachmentUrl,
  isAttachmentKey,
  isAttachmentKeyForForm,
} from "@/lib/attachments";
import { buildRow } from "@/lib/sheets/format";

const FORM = "3f2b6a1e-9c4d-4e8f-a1b2-c3d4e5f60718";
const OTHER = "11111111-2222-4333-8444-555555555555";
const KEY = `${FORM}/121140001/1794752056732-a1b2c3d4-CV_Yoel.pdf`;

test("valid key is accepted", () => {
  assert.equal(isAttachmentKey(KEY), true);
  assert.equal(isAttachmentKeyForForm(KEY, FORM), true);
  assert.equal(isAttachmentKeyForForm(KEY, FORM.toUpperCase()), true);
});

test("key of another form is rejected", () => {
  assert.equal(isAttachmentKeyForForm(KEY, OTHER), false);
});

test("URLs, traversal and made-up paths are rejected", () => {
  for (const bad of [
    "https://evil.example/x.pdf",
    `https://abc.supabase.co/storage/v1/object/public/form-attachments/${KEY}`,
    `${FORM}/../../etc/passwd`,
    `${FORM}/x/1794752056732-a1b2c3d4-../../a.pdf`.replace("../../", "/"),
    `${FORM}/x/123-a1b2c3d4-a.pdf`, // timestamp too short
    `${FORM}/x/1794752056732-zzzzzzzz-a.pdf`, // random part not hex
    `${FORM}/x y/1794752056732-a1b2c3d4-a.pdf`, // space in respondent key
    "",
    null,
    42,
  ]) {
    assert.equal(isAttachmentKey(bad), false, String(bad));
  }
});

test("file name and links", () => {
  assert.equal(attachmentFileName(KEY), "CV_Yoel.pdf");
  assert.equal(attachmentPath(KEY), `/admin/attachments?key=${encodeURIComponent(KEY)}`);
  assert.ok(attachmentPath(KEY, true).endsWith("&download=1"));
  assert.ok(attachmentUrl(KEY).startsWith("https://form.pmkitera.web.id/admin/attachments?key="));
});

test("Sheets row turns a file answer into the admin link", () => {
  const row = buildRow(
    [
      { id: "f_nama", label: "Nama", type: "short_text" },
      { id: "f_cv", label: "CV", type: "file_upload" },
    ],
    { f_nama: "Yoel", f_cv: KEY },
    "resp-1"
  );
  assert.equal(row[0], "Yoel");
  assert.equal(row[1], attachmentUrl(KEY));
  assert.equal(row[2], "resp-1");
});
