import { getAdminUser } from "@/lib/auth";
import { attachmentFileName, isAttachmentKey } from "@/lib/attachments";
import { getAttachment } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Types a browser may show inline. Everything else (Word files) is always downloaded.
const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

/**
 * GET /admin/attachments?key=<r2 key>[&download=1]
 *
 * The only way to read an uploaded file: the R2 bucket is private. Admin session required
 * (proxy.ts already sends signed-out visitors to the login page; this re-checks the admin row).
 */
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!isAttachmentKey(key)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const object = await getAttachment(key);
  if (!object) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const inline = INLINE_TYPES.has(object.contentType) && url.searchParams.get("download") !== "1";
  const fileName = attachmentFileName(key);

  return new Response(Buffer.from(object.body), {
    status: 200,
    headers: {
      "Content-Type": INLINE_TYPES.has(object.contentType) ? object.contentType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Uploaded content is untrusted: never let it run scripts on this origin.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
