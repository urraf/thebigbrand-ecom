import { z } from "zod";
import { paginationSchema, parseBody, parseQuery, route } from "@/lib/api";
import { bulkUpdateInventory, listSellerProducts, PRODUCT_TABS } from "@/server/seller/products";
import { InventorySchema } from "@/server/seller/schemas";

const Query = paginationSchema.extend({
  status: z.enum(PRODUCT_TABS).default("all"),
  q: z.string().trim().max(100).optional(),
  lowStock: z.enum(["1", "true"]).optional(),
});

/** GET /api/v1/seller/inventory — stock & price sheet (same filters as products). */
export const GET = route({ auth: "seller" }, async ({ req, seller }) => {
  const q = parseQuery(req, Query);
  const out = await listSellerProducts(seller!.id, { tab: q.status, q: q.q, page: q.page, limit: q.limit ?? 50, lowStock: !!q.lowStock });
  return { ...out, items: out.items.map(({ id, name, sku, size, status, mrp, price, stock, brand, unitsSold }) => ({ id, name, sku, size, status, mrp, price, stock, brand: brand.name, unitsSold })) };
});

/** PATCH /api/v1/seller/inventory { items: [{ id, stock?, price? }] } — bulk update (price ≤ MRP; no re-review). */
export const PATCH = route({ auth: "seller" }, async ({ req, auth, seller }) => {
  const { items } = await parseBody(req, InventorySchema);
  return bulkUpdateInventory(seller!, auth!.user.id, items);
});
