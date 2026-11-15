import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 access (S3-compatible). Server only: the keys never reach the browser.
 *
 * Env:
 *   R2_ACCOUNT_ID         Cloudflare account id (endpoint https://<id>.r2.cloudflarestorage.com)
 *   R2_ENDPOINT           optional override (e.g. a local MinIO for development)
 *   R2_ACCESS_KEY_ID      R2 API token, Object Read & Write, limited to the bucket below
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET             private bucket for form attachments
 */

let client: S3Client | null = null;

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Konfigurasi penyimpanan file (R2) belum lengkap.");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function s3(): { s3: S3Client; bucket: string } {
  const c = config();
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: c.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return { s3: client, bucket: c.bucket };
}

export async function putAttachment(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const { s3: c, bucket } = s3();
  await c.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Write-once: refuse to overwrite an existing object.
      IfNoneMatch: "*",
    })
  );
}

export interface AttachmentObject {
  body: Uint8Array;
  contentType: string;
}

/** Returns null when the object does not exist. */
export async function getAttachment(key: string): Promise<AttachmentObject | null> {
  const { s3: c, bucket } = s3();
  try {
    const res = await c.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    return {
      body: await res.Body.transformToByteArray(),
      contentType: res.ContentType || "application/octet-stream",
    };
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}
