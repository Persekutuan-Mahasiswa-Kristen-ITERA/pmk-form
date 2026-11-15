/**
 * Attachment keys (shared by server and client; no secrets here).
 *
 * Uploaded files live in a PRIVATE Cloudflare R2 bucket. A response stores the object KEY,
 * never a public URL. Admins open a file through /admin/attachments?key=..., which checks the
 * admin session and streams the object from R2.
 *
 * Key format: <formId>/<respondentKey>/<epochMillis>-<8 hex>-<safe file name>
 * The random part makes keys unguessable, so one respondent cannot point at another's file.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const ATTACHMENT_KEY_RE = new RegExp(
  `^(${UUID})/[A-Za-z0-9_-]{1,80}/[0-9]{10,16}-[0-9a-f]{8}-[A-Za-z0-9._-]{1,200}$`,
  "i"
);

export function isAttachmentKey(value: unknown): value is string {
  return typeof value === "string" && ATTACHMENT_KEY_RE.test(value);
}

/** True when the key is a valid attachment key that belongs to this form. */
export function isAttachmentKeyForForm(value: unknown, formId: string): value is string {
  if (!isAttachmentKey(value)) return false;
  return value.slice(0, value.indexOf("/")).toLowerCase() === formId.toLowerCase();
}

/** Same-origin admin link for a key (relative). */
export function attachmentPath(key: string, download = false): string {
  return `/admin/attachments?key=${encodeURIComponent(key)}${download ? "&download=1" : ""}`;
}

/** Absolute admin link, for places outside the app such as Google Sheets. */
export function attachmentUrl(key: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://form.pmkitera.web.id").replace(/\/+$/, "");
  return `${base}${attachmentPath(key)}`;
}

/** Original file name shown to admins (the part after "<millis>-<hex>-"). */
export function attachmentFileName(key: string): string {
  const last = key.slice(key.lastIndexOf("/") + 1);
  return last.replace(/^[0-9]{10,16}-[0-9a-f]{8}-/i, "");
}
