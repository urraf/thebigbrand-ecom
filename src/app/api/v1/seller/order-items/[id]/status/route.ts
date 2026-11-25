import { parseBody, route } from "@/lib/api";
import { setSellerItemStatus } from "@/server/seller/orders";
import { FulfilSchema } from "@/server/seller/schemas";

/** POST /api/v1/seller/order-items/:id/status { action: confirm | pack | ship, courier?, trackingNumber? } — one item. */
export const POST = route<{ id: string }>({ auth: "seller" }, async ({ req, params, auth, seller }) => {
  const body = await parseBody(req, FulfilSchema);
  return setSellerItemStatus(seller!, auth!.user.id, params.id, { action: body.action, courier: body.courier, trackingNumber: body.trackingNumber });
});
