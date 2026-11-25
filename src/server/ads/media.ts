import "server-only";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { storeUpload } from "@/lib/storage";

/**
 * Detect the real image type from the file's magic bytes. The declared Content-Type comes from the client and
 * cannot be trusted (a renamed text/HTML file would otherwise be stored and served as an "image").
 */
function sniffImageType(b: Uint8Array): string | null {
  const at = (o: number, ...xs: number[]) => xs.every((x, i) => b[o + i] === x);
  const ascii = (o: number, s: string) => [...s].every((ch, i) => b[o + i] === ch.charCodeAt(0));
  if (b.length < 12) return null;
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  return null;
}

/** Upload an ad creative image (booking form). Stored under /uploads/creatives/… and recorded as Media. */
export async function uploadCreative(userId: string, file: File, alt?: string | null) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw err.badRequest("Only JPG, PNG, WEBP, AVIF or GIF images are allowed");
  // re-wrap with the detected type so storage picks the right extension / content type
  const safe = new File([bytes], file.name || "creative", { type });
  let stored;
  try {
    stored = await storeUpload(safe, "uploads/creatives");
  } catch (e) {
    throw err.badRequest(e instanceof Error ? e.message : "Upload failed");
  }
  const media = await db.media.create({
    data: { url: stored.url, mime: stored.mime, size: stored.size, alt: alt?.slice(0, 200) || null, uploadedById: userId },
    select: { id: true, url: true, mime: true, size: true },
  });
  return media;
}
