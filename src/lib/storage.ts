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

/** Detect the real image type from the file's first bytes (never trust the client-declared type). */
export function sniffImageType(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 6 && (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (b.length >= 12 && b.subarray(4, 8).toString("ascii") === "ftyp" && /^avi[fs]$/.test(b.subarray(8, 12).toString("ascii"))) return "image/avif";
  return null;
}

export async function storeUpload(file: File, folder = "uploads"): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5 MB or smaller");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  const ext = mime ? ALLOWED_IMAGE_TYPES[mime] : undefined;
  if (!mime || !ext) throw new Error("Only JPG, PNG, WEBP, AVIF or GIF images are allowed");
  const now = new Date();
  const rel = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomBytes(10).toString("hex")}.${ext}`;

  if (env.storage.driver === "blob") {
    if (!env.storage.blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
    const { put } = await import("@vercel/blob");
    const blob = await put(rel, bytes, { access: "public", contentType: mime, token: env.storage.blobToken });
    return { url: blob.url, mime, size: file.size };
  }

  const abs = path.join(process.cwd(), "public", rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return { url: `/${rel}`, mime, size: file.size };
}
