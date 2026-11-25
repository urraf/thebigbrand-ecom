import "server-only";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { storeUpload } from "@/lib/storage";

/** Product photos & store logos uploaded by a seller (type + 5 MB limit enforced by storeUpload). */
export async function uploadSellerMedia(userId: string, sellerSlug: string, file: unknown, alt?: string | null) {
  if (!(file instanceof File) || file.size === 0) throw err.badRequest("Choose an image to upload");
  let stored;
  try {
    stored = await storeUpload(file, "uploads/sellers");
  } catch (e) {
    throw err.badRequest(e instanceof Error ? e.message : "Upload failed");
  }
  const media = await db.media.create({
    data: { url: stored.url, mime: stored.mime, size: stored.size, alt: alt?.slice(0, 160) || null, uploadedById: userId },
    select: { id: true, url: true, mime: true, size: true, alt: true },
  });
  return { ...media, seller: sellerSlug };
}
