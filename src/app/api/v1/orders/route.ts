import { parseQuery, route } from "@/lib/api";
import { listOrders, orderListQuery } from "@/server/orders/customer";

/**
 * GET /api/v1/orders?status=all|active|unpaid|delivered|returns|cancelled&page=1&limit=10  (signed in)
 * → { items: OrderListItem[], total, page, limit, pages, counts: { all, active, … } } — the user's own orders, newest first.
 */
export const GET = route({ auth: "user" }, async ({ req, auth }) => listOrders(auth!.user.id, parseQuery(req, orderListQuery)));
