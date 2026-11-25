import { err, parseBody, route } from "@/lib/api";
import { archiveProduct, getProductForEdit, ProductPatch, updateProduct } from "@/server/admin/core/products";

/** GET /api/v1/admin/products/:id — every field + images (with source/licence) for editing. */
export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  const p = await getProductForEdit(params.id);
  if (!p) throw err.notFound("Product not found");
  return p;
});

/** PATCH /api/v1/admin/products/:id — any subset of the create fields. `images` (if sent) replaces the gallery in order. */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, ProductPatch);
  return updateProduct(params.id, body, auth!.user.id);
});

/** DELETE /api/v1/admin/products/:id — archive (hidden from the store; past orders keep their snapshot). */
export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, auth }) => archiveProduct(params.id, auth!.user.id));
