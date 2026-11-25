import { err, rateLimit, route } from "@/lib/api";
import { uploadSellerMedia } from "@/server/seller/media";

/** POST /api/v1/seller/media (multipart: file, alt?) — upload a product photo or store logo (JPG/PNG/WEBP/AVIF/GIF ≤ 5 MB). */
export const POST = route({ auth: "seller" }, async ({ req, auth, seller }) => {
  rateLimit(`seller-media:${seller!.id}`, 120, 60 * 60 * 1000);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw err.badRequest("Send the image as multipart/form-data (field: file)");
  }
  const alt = form.get("alt");
  return uploadSellerMedia(auth!.user.id, seller!.slug, form.get("file"), typeof alt === "string" ? alt : null);
});
