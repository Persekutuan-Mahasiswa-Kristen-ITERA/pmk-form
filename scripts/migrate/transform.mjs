// Pure helpers for moving data from the OLD pmk-form Supabase project to schema `form` in PI-CORE.
// No network here, so they can be unit tested (tests/migrate-transform.test.ts).
import { randomBytes } from "node:crypto";

export const OLD_BUCKET = "form-attachments";
const PUBLIC_MARKER = `/storage/v1/object/public/${OLD_BUCKET}/`;
const KEY_TAIL_RE = /^([0-9]{10,16})-(.+)$/;

/** Old public URL (or bare bucket path) -> bucket path, or null when it is not an old attachment. */
export function oldPathFromValue(value) {
  if (typeof value !== "string" || value === "") return null;
  const i = value.indexOf(PUBLIC_MARKER);
  if (i >= 0) return decodeURIComponent(value.slice(i + PUBLIC_MARKER.length).split("?")[0]);
  return null;
}

function safeSegment(s, max) {
  return (s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, max) || "anonymous");
}
function safeName(s) {
  return (s.replace(/[^A-Za-z0-9.-]/g, "_").slice(0, 200) || "lampiran");
}

/**
 * Old path "<formId>/<respondent>/<millis>-<name>" -> new key "<formId>/<respondent>/<millis>-<8hex>-<name>"
 * (the format lib/attachments.ts accepts). Anything else is placed under "<formId>/migrated/".
 */
export function newKeyForOldPath(oldPath, formId, hex = randomBytes(4).toString("hex")) {
  const parts = oldPath.split("/");
  const fid = formId.toLowerCase();
  if (parts.length === 3 && parts[0].toLowerCase() === fid) {
    const m = KEY_TAIL_RE.exec(parts[2]);
    if (m) return `${fid}/${safeSegment(parts[1], 80)}/${m[1]}-${hex}-${safeName(m[2])}`;
  }
  return `${fid}/migrated/${Date.now()}-${hex}-${safeName(parts[parts.length - 1] || "lampiran")}`;
}

/**
 * Rewrite one response: every old attachment URL in `answers` (file fields) and `files` becomes an R2 key.
 * `keyFor(oldPath)` must return the same key for the same path (so answers and files agree).
 * Returns { answers, files, moves: [{ oldPath, newKey }] }.
 */
export function rewriteResponse(response, fileFieldIds, keyFor) {
  const moves = new Map();
  const map = (value) => {
    const oldPath = oldPathFromValue(value);
    if (!oldPath) return value;
    if (!moves.has(oldPath)) moves.set(oldPath, keyFor(oldPath));
    return moves.get(oldPath);
  };
  const answers = { ...(response.answers || {}) };
  for (const id of fileFieldIds) if (id in answers) answers[id] = map(answers[id]);
  const files = (Array.isArray(response.files) ? response.files : []).map(map);
  return { answers, files, moves: [...moves].map(([oldPath, newKey]) => ({ oldPath, newKey })) };
}
