import { parseQuery, route } from "@/lib/api";
import { listOrders, OrderListQuery } from "@/server/admin/core/orders";

/**
 * GET /api/v1/admin/orders?q&status&method&pay&from&to&seller&sort&dir&page&limit
 * status: PENDING_PAYMENT|PLACED|CONFIRMED|PACKED|SHIPPED|DELIVERED|CANCELLED|RETURNED · method: RAZORPAY|COD|TEST|PREPAID
 * pay: PENDING|PAID|FAILED|REFUNDED|COD_PENDING · from/to: yyyy-mm-dd (IST) · seller: <sellerId>|tbb · sort: placed|total|number
 * → paged list + `counts` per status group (for filter chips).
 */
export const GET = route({ auth: "admin" }, async ({ req }) => listOrders(parseQuery(req, OrderListQuery)));
