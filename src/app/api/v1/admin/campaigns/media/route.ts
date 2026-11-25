import { err, rateLimit, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { storeUpload } from "@/lib/storage";

/**
 * POST /api/v1/admin/campaigns/media (admin, multipart `file`) → { id, url, mime, size }
 * Uploads an ad creative (JPG/PNG/WEBP/AVIF/GIF ≤ 5 MB) via storeUpload() into /uploads/creatives and records a Media row.
 */
export const POST = route({ auth: "admin" }, async ({ req, auth }) => {
  rateLimit(`creative-upload:${auth!.user.id}`, 30, 60_000);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw err.badRequest("Send the image as multipart/form-data with a `file` field");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw err.badRequest("Choose an image to upload");
  let stored;
  try {
    stored = await storeUpload(file, "uploads/creatives");
  } catch (e) {
    throw err.unprocessable(e instanceof Error ? e.message : "Upload failed");
  }
  const alt = String(form.get("alt") ?? "").slice(0, 200) || null;
  const media = await db.media.create({ data: { url: stored.url, mime: stored.mime, size: stored.size, alt, uploadedById: auth!.user.id } });
  await audit(auth!.user.id, "media.upload", "Media", media.id, { url: stored.url, area: "creatives" });
  return { id: media.id, url: stored.url, mime: stored.mime, size: stored.size };
});
