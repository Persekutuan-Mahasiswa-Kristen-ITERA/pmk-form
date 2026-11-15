#!/usr/bin/env node
// Move pmk-form data from the OLD Supabase project to schema `form` in the PI-CORE project,
// and its attachments from the old public Storage bucket to the private R2 bucket.
//
//   node scripts/migrate/run.mjs            DRY RUN (default): reads everything, writes NOTHING,
//                                           prints counts and saves a plan to migrate-report.json
//   node scripts/migrate/run.mjs --apply    copies files to R2, then upserts rows into form.*
//
// Safe to run again: rows are upserted by primary key, files that already exist in R2 are skipped.
// Legacy oprec tables (submissions, recruitments, selection_results) are NOT handled here: see
// scripts/migrate/legacy-tables.sh (they need pg_dump because their structure is not in this repo).
//
// Env (put them in a file you do NOT commit, e.g. scripts/migrate/.env.migrate, and `set -a; . file`):
//   OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY    old pmk-form project (read only)
//   NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY    PI-CORE project (schema `form` must exist)
//   R2_ACCOUNT_ID or R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   BOOTSTRAP_ADMIN_EMAILS (optional) PI-CORE account email(s) to invite as the first admin(s)
import { writeFileSync } from "node:fs";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { OLD_BUCKETS, newKeyForOldPath, rewriteResponse, splitOldPath } from "./transform.mjs";

const APPLY = process.argv.includes("--apply");
const env = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v.replace(/\/+$/, "");
};
const OLD = { url: env("OLD_SUPABASE_URL"), key: env("OLD_SUPABASE_SERVICE_ROLE_KEY") };
const NEW = { url: env("NEW_SUPABASE_URL"), key: env("NEW_SUPABASE_SERVICE_ROLE_KEY") };
if (OLD.url === NEW.url) throw new Error("OLD_SUPABASE_URL and NEW_SUPABASE_URL are the same project. Stopping.");

const R2_BUCKET = env("R2_BUCKET");
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
});

const headers = (p, extra = {}) => ({ apikey: p.key, Authorization: `Bearer ${p.key}`, ...extra });

// Paged read ordered by primary key, so pages are stable.
async function readAll(table, pk = "id") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${OLD.url}/rest/v1/${table}?select=*&order=${pk}.asc`, {
      headers: headers(OLD, { "Accept-Profile": "public", Range: `${from}-${from + 999}` }),
    });
    if (!res.ok) throw new Error(`read ${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${NEW.url}/rest/v1/${table}?on_conflict=${table === "sheets_outbox" ? "response_id" : "id"}`, {
      method: "POST",
      headers: headers(NEW, {
        "Content-Profile": "form",
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`upsert form.${table}: HTTP ${res.status} ${await res.text()}`);
  }
}

async function countNew(table) {
  const res = await fetch(`${NEW.url}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: headers(NEW, { "Accept-Profile": "form", Prefer: "count=exact", Range: "0-0" }),
  });
  return Number((res.headers.get("content-range") || "*/?").split("/")[1]);
}

async function r2Exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyFile(oldPath, newKey) {
  if (await r2Exists(newKey)) return "exists";
  const { bucket, path } = splitOldPath(oldPath);
  const res = await fetch(`${OLD.url}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    headers: headers(OLD),
  });
  if (res.status === 404 || res.status === 400) return "missing";
  if (!res.ok) throw new Error(`download ${oldPath}: HTTP ${res.status}`);
  const body = new Uint8Array(await res.arrayBuffer());
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: newKey,
      Body: body,
      ContentType: res.headers.get("content-type") || "application/octet-stream",
    })
  );
  return "copied";
}

// Every object of the old buckets, recursively (folders have id === null in the Storage list API).
async function listBucket(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${OLD.url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: headers(OLD, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: HTTP ${res.status}`);
    const items = await res.json();
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) out.push(...(await listBucket(bucket, path)));
      else out.push({ oldPath: `${bucket}/${path}`, size: it.metadata?.size ?? 0 });
    }
    if (items.length < 1000) return out;
  }
}

// Full copy of both old buckets under archive/ (not reachable through the app; Cloudflare dashboard only).
// Covers files that only the legacy oprec tables point to, and uploads no response points to.
const ARCHIVE_PREFIX = "archive/old-project/";

// Stable new keys across runs: reuse the plan of a previous run if present.
let previous = {};
try {
  previous = JSON.parse((await import("node:fs")).readFileSync("migrate-report.json", "utf8")).keyMap || {};
} catch {}

console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${OLD.url}  ->  ${NEW.url} (schema form), files -> R2 bucket ${R2_BUCKET}`);

const [forms, responses, outbox, admins, audit] = await Promise.all([
  readAll("forms"),
  readAll("form_responses"),
  readAll("sheets_outbox", "response_id").catch(() => []),
  readAll("admin_members"),
  readAll("admin_audit_log").catch(() => []),
]);
console.log(`old project: ${forms.length} forms, ${responses.length} responses, ${outbox.length} outbox, ${admins.length} admins, ${audit.length} audit rows`);

const fileFields = new Map(
  forms.map((f) => [f.id, (Array.isArray(f.form_fields) ? f.form_fields : []).filter((x) => x?.type === "file_upload").map((x) => x.id)])
);
const keyMap = { ...previous };
const moves = [];
const newResponses = responses.map((r) => {
  const out = rewriteResponse(r, fileFields.get(r.form_id) || [], (oldPath) => {
    if (!keyMap[oldPath]) keyMap[oldPath] = newKeyForOldPath(oldPath, r.form_id);
    return keyMap[oldPath];
  });
  moves.push(...out.moves);
  return {
    id: r.id,
    form_id: r.form_id,
    answers: out.answers,
    files: out.files,
    respondent_id: null, // old project's auth ids mean nothing in PI-CORE
    submitted_at: r.submitted_at,
    updated_at: r.updated_at,
    nim_normalized: r.nim_normalized ?? null,
    status: r.status ?? null,
  };
});
const uniqueMoves = [...new Map(moves.map((m) => [m.oldPath, m])).values()];
console.log(`attachments to move: ${uniqueMoves.length}`);

const archive = [];
for (const bucket of OLD_BUCKETS) archive.push(...(await listBucket(bucket)));
console.log(`archive: ${archive.length} objects, ${(archive.reduce((a, o) => a + o.size, 0) / 1048576).toFixed(1)} MB -> ${ARCHIVE_PREFIX}`);

// Old auth ids are dropped: admins re-link by email on their first PI-CORE login.
const newForms = forms.map((f) => ({
  id: f.id, title: f.title, description: f.description, slug: f.slug, form_type: f.form_type,
  is_open: f.is_open, open_date: f.open_date, close_date: f.close_date, form_fields: f.form_fields,
  settings: f.settings, sheets_config: f.sheets_config ?? null, created_by: null,
  created_at: f.created_at, updated_at: f.updated_at, is_deleted: f.is_deleted ?? false, deleted_at: f.deleted_at ?? null,
}));
const newAdmins = admins.map((a) => ({
  id: a.id, email: a.email, role: a.role, status: a.status, user_id: null, invited_by: null,
  created_at: a.created_at, last_login_at: a.last_login_at,
}));
const newAudit = audit.map((a) => ({ ...a, actor_user_id: null }));

// First admin(s) with a real PI-CORE account (old admins may have none). Added as an invite that turns
// active on their first PI-CORE login. BOOTSTRAP_ADMIN_EMAILS="a@x,b@y"
const bootstrap = (process.env.BOOTSTRAP_ADMIN_EMAILS || "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  .filter((e) => !newAdmins.some((a) => a.email === e));
const bootstrapRows = bootstrap.map((email) => ({ email, role: "super_admin", status: "invited" }));
if (bootstrapRows.length) console.log(`bootstrap admins (invited): ${bootstrap.join(", ")}`);

writeFileSync(
  "migrate-report.json",
  JSON.stringify({ at: new Date().toISOString(), apply: APPLY, counts: { forms: forms.length, responses: responses.length, outbox: outbox.length, admins: admins.length, audit: audit.length, files: uniqueMoves.length, archive: archive.length }, keyMap }, null, 2)
);
console.log("plan saved to migrate-report.json (contains file paths, do not commit or share)");

if (!APPLY) {
  console.log("DRY RUN finished. Nothing was written. Run again with --apply to copy.");
  process.exit(0);
}

let copied = 0, existed = 0;
const missing = [];
for (const m of uniqueMoves) {
  const r = await copyFile(m.oldPath, m.newKey);
  if (r === "copied") copied++;
  else if (r === "exists") existed++;
  else missing.push(m.oldPath);
}
console.log(`files: ${copied} copied, ${existed} already in R2, ${missing.length} missing in old bucket`);

let archived = 0, archivedBefore = 0;
const archiveMissing = [];
for (const o of archive) {
  const r = await copyFile(o.oldPath, ARCHIVE_PREFIX + o.oldPath);
  if (r === "copied") archived++;
  else if (r === "exists") archivedBefore++;
  else archiveMissing.push(o.oldPath);
}
console.log(`archive: ${archived} copied, ${archivedBefore} already in R2, ${archiveMissing.length} failed`);
if (missing.length) console.log("missing (answers keep the new key; admins will get 404):", missing.slice(0, 20));

await upsert("forms", newForms);
await upsert("form_responses", newResponses);
await upsert("sheets_outbox", outbox);
await upsert("admin_members", newAdmins);
if (bootstrapRows.length) {
  // Insert by email; an existing row for that email is left alone (no id in the payload).
  const res = await fetch(`${NEW.url}/rest/v1/admin_members?on_conflict=email`, {
    method: "POST",
    headers: headers(NEW, {
      "Content-Profile": "form",
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    }),
    body: JSON.stringify(bootstrapRows),
  });
  if (!res.ok) throw new Error(`bootstrap admins: HTTP ${res.status} ${await res.text()}`);
}
await upsert("admin_audit_log", newAudit);

const after = {};
for (const t of ["forms", "form_responses", "sheets_outbox", "admin_members", "admin_audit_log"]) after[t] = await countNew(t);
console.log("new project row counts:", after);
const bad = after.forms < forms.length || after.form_responses < responses.length || after.admin_members < admins.length;
if (bad) {
  console.error("Row counts in the new project are LOWER than in the old one. Check before switching the app.");
  process.exit(1);
}
console.log("APPLY finished.");
