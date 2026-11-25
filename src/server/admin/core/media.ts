import "server-only";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { storeUpload } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

/** Real image type from the first bytes (JPG/PNG/GIF/WEBP/AVIF) — never trust the client-declared type. */
function looksLikeImage(b: Buffer): boolean {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  const a6 = b.subarray(0, 6).toString("ascii");
  if (a6 === "GIF87a" || a6 === "GIF89a") return true;
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return true;
  return b.length >= 12 && b.subarray(4, 8).toString("ascii") === "ftyp" && /^avi[fs]$/.test(b.subarray(8, 12).toString("ascii"));
}

/**
 * Store an uploaded image and record it in the media library. The real type is checked from the file's
 * bytes here (never the client-declared type) as well as inside storeUpload — a renamed text file is refused.
 */
export async function uploadMedia(file: File, alt: string | null, userId: string) {
  if (file.size > MAX_BYTES) throw err.unprocessable("Image must be 5 MB or smaller");
  const head = Buffer.from(await file.slice(0, 32).arrayBuffer());
  if (!looksLikeImage(head)) throw err.unprocessable("Only JPG, PNG, WEBP, AVIF or GIF images are allowed");
  let stored;
  try {
    stored = await storeUpload(file, "uploads/admin");
  } catch (e) {
    throw err.unprocessable(e instanceof Error ? e.message : "Upload failed");
  }
  const m = await db.media.create({ data: { url: stored.url, mime: stored.mime, size: stored.size, alt, uploadedById: userId } });
  return { id: m.id, url: m.url, mime: m.mime, size: m.size, alt: m.alt, createdAt: m.createdAt.toISOString() };
}

export async function listMedia(page: number, limit: number) {
  const [total, rows] = await Promise.all([
    db.media.count(),
    db.media.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { uploadedBy: { select: { name: true } } } }),
  ]);
  return { total, rows: rows.map((m) => ({ id: m.id, url: m.url, mime: m.mime, size: m.size, alt: m.alt, uploadedBy: m.uploadedBy?.name ?? null, createdAt: m.createdAt.toISOString() })) };
}
