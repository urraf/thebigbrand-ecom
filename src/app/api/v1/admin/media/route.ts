import { err, paged, paginationSchema, parseQuery, rateLimit, route } from "@/lib/api";
import { listMedia, uploadMedia } from "@/server/admin/core/media";

/**
 * POST /api/v1/admin/media  multipart/form-data: file (JPG/PNG/WEBP/AVIF/GIF ≤ 5 MB), alt?  → { id, url, mime, size }
 * GET  /api/v1/admin/media?page&limit  → recent uploads (media library)
 */
export const POST = route({ auth: "admin" }, async ({ req, auth }) => {
  rateLimit(`media:${auth!.user.id}`, 60, 60_000);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw err.badRequest("Send the image as multipart/form-data with a `file` field");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw err.badRequest("Choose an image to upload");
  const alt = typeof form.get("alt") === "string" ? String(form.get("alt")).slice(0, 200) || null : null;
  return uploadMedia(file, alt, auth!.user.id);
});

export const GET = route({ auth: "admin" }, async ({ req }) => {
  const { page, limit } = parseQuery(req, paginationSchema);
  const { total, rows } = await listMedia(page, limit);
  return paged(rows, total, page, limit);
});
