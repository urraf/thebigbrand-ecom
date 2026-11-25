import { z } from "zod";
import { paginationSchema, parseBody, parseQuery, rateLimit, route } from "@/lib/api";
import { createSellerProduct, listSellerProducts, PRODUCT_TABS } from "@/server/seller/products";
import { ProductSchema } from "@/server/seller/schemas";

const Query = paginationSchema.extend({
  status: z.enum(PRODUCT_TABS).default("all"),
  q: z.string().trim().max(100).optional(),
  lowStock: z.enum(["1", "true"]).optional(),
});

/** GET /api/v1/seller/products?status=&q=&page=&limit=&lowStock=1 — my products with status counts. */
export const GET = route({ auth: "seller" }, async ({ req, seller }) => {
  const q = parseQuery(req, Query);
  return listSellerProducts(seller!.id, { tab: q.status, q: q.q, page: q.page, limit: q.limit, lowStock: !!q.lowStock });
});

/** POST /api/v1/seller/products — create a product (submit=true → PENDING for admin approval, false → DRAFT). */
export const POST = route({ auth: "seller" }, async ({ req, auth, seller }) => {
  rateLimit(`seller-product:${seller!.id}`, 60, 60 * 60 * 1000);
  const input = await parseBody(req, ProductSchema);
  return createSellerProduct(seller!, auth!.user.id, input);
});
