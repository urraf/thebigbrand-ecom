import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * File storage for uploads (product photos, ad creatives, seller logos).
 * - "local": writes to /public/uploads/YYYY/MM/<random>.<ext> and returns "/uploads/…" (dev & single-server deploys).
 * - "blob": Vercel Blob (set STORAGE_DRIVER=blob and BLOB_READ_WRITE_TOKEN) — required on Vercel, whose filesystem is read-only.
 */

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type StoredFile = { url: string; mime: string; size: number };

export async function storeUpload(file: File, folder = "uploads"): Promise<StoredFile> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Only JPG, PNG, WEBP, AVIF or GIF images are allowed");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5 MB or smaller");
  const bytes = Buffer.from(await file.arrayBuffer());
  const now = new Date();
  const rel = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomBytes(10).toString("hex")}.${ext}`;

  if (env.storage.driver === "blob") {
    if (!env.storage.blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
    const { put } = await import("@vercel/blob");
    const blob = await put(rel, bytes, { access: "public", contentType: file.type, token: env.storage.blobToken });
    return { url: blob.url, mime: file.type, size: file.size };
  }

  const abs = path.join(process.cwd(), "public", rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return { url: `/${rel}`, mime: file.type, size: file.size };
}
