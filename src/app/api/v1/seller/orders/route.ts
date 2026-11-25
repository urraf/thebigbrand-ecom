import { z } from "zod";
import { paginationSchema, parseQuery, route } from "@/lib/api";
import { listSellerOrders, ORDER_TAB_KEYS } from "@/server/seller/orders";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Query = paginationSchema.extend({
  status: z.enum(ORDER_TAB_KEYS as [string, ...string[]]).default("all"),
  q: z.string().trim().max(60).optional(),
  from: day.optional(),
  to: day.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

/**
 * GET /api/v1/seller/orders?status=all|open|new|confirmed|packed|shipped|delivered|closed&q=&from=&to=&page=
 * Orders containing my items (only my items are returned), newest first, with per-tab counts.
 */
export const GET = route({ auth: "seller" }, async ({ req, seller }) => {
  const q = parseQuery(req, Query);
  return listSellerOrders(seller!.id, { tab: q.status as (typeof ORDER_TAB_KEYS)[number], q: q.q, from: q.from, to: q.to, page: q.page, limit: q.limit });
});
