import { err, route } from "@/lib/api";
import { getSellerOrder } from "@/server/seller/orders";

/** GET /api/v1/seller/orders/:number — my items in this order, ship-to (full only while fulfilment is open) and timeline. */
export const GET = route<{ number: string }>({ auth: "seller" }, async ({ params, seller }) => {
  const o = await getSellerOrder(seller!.id, params.number);
  if (!o) throw err.notFound("Order not found");
  return o;
});
