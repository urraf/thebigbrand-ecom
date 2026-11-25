import { err, rateLimit, route } from "@/lib/api";
import { uploadCreative } from "@/server/ads/media";

/**
 * POST /api/v1/ads/media  (signed in, multipart/form-data: file=<image>, alt?)  → { id, url, mime, size }
 * Uploads a finished ad creative (JPG/PNG/WEBP/AVIF/GIF, ≤ 5 MB) for a booking.
 */
export const POST = route({ auth: "user" }, async ({ req, auth }) => {
  rateLimit(`admedia:${auth!.user.id}`, 20, 10 * 60_000);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw err.badRequest("Send the image as multipart/form-data");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw err.badRequest("Choose an image to upload");
  const alt = form.get("alt");
  return uploadCreative(auth!.user.id, file, typeof alt === "string" ? alt : null);
});
