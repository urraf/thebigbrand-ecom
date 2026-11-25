import { parseBody, route } from "@/lib/api";
import { changeOrderStatus, OrderStatusBody } from "@/server/admin/core/orders";

/**
 * POST /api/v1/admin/orders/:number/status { to: CONFIRMED|PACKED|SHIPPED|DELIVERED|CANCELLED|RETURNED, note?, courier?, trackingNumber? }
 * Moves every eligible item (via the order lifecycle). SHIPPED requires `courier`.
 */
export const POST = route<{ number: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, OrderStatusBody);
  return changeOrderStatus(params.number, body, auth!.user.id);
});
