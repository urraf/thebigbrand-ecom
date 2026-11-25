import { err, route } from "@/lib/api";
import { COURIERS, getOrderDetail } from "@/server/admin/core/orders";

/** GET /api/v1/admin/orders/:number — full order (items + seller, gifts, payments, timeline, customer, allowed next statuses). */
export const GET = route<{ number: string }>({ auth: "admin" }, async ({ params }) => {
  const order = await getOrderDetail(params.number);
  if (!order) throw err.notFound("Order not found");
  return { ...order, couriers: COURIERS };
});
