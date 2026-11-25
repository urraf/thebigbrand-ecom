import { err, parseBody, route } from "@/lib/api";
import { deleteSellerProduct, getSellerProduct, updateSellerProduct } from "@/server/seller/products";
import { ProductSchema } from "@/server/seller/schemas";

type P = { id: string };

/** GET /api/v1/seller/products/:id — one of my products (full detail for the editor). */
export const GET = route<P>({ auth: "seller" }, async ({ params, seller }) => {
  const p = await getSellerProduct(seller!.id, params.id);
  if (!p) throw err.notFound("Product not found");
  return p;
});

/** PUT /api/v1/seller/products/:id — replace product content. Content edits re-enter review; price/stock-only edits stay live. */
export const PUT = route<P>({ auth: "seller" }, async ({ req, params, auth, seller }) => {
  const input = await parseBody(req, ProductSchema);
  return updateSellerProduct(seller!, auth!.user.id, params.id, input);
});
export const PATCH = PUT;

/** DELETE /api/v1/seller/products/:id — delete a draft/rejected product that has never been ordered. */
export const DELETE = route<P>({ auth: "seller" }, async ({ params, auth, seller }) => deleteSellerProduct(seller!, auth!.user.id, params.id));
