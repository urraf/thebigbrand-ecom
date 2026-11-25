import { api, ApiFailure } from "./api";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const MAX_IMAGE_MB = 5;

/** Upload one image to POST /api/v1/seller/media (client-side type/size check first). */
export async function uploadImage(file: File, alt?: string): Promise<{ id: string; url: string }> {
  if (!IMAGE_TYPES.includes(file.type)) throw new ApiFailure(`${file.name}: use JPG, PNG, WEBP, AVIF or GIF`, 400, "BAD_TYPE");
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new ApiFailure(`${file.name} is larger than ${MAX_IMAGE_MB} MB`, 400, "TOO_LARGE");
  const form = new FormData();
  form.set("file", file);
  if (alt) form.set("alt", alt);
  return api<{ id: string; url: string }>("/api/v1/seller/media", { form });
}
