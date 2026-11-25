import { parseBody, rateLimit, route } from "@/lib/api";
import { fulfilOrder } from "@/server/seller/orders";
import { FulfilSchema } from "@/server/seller/schemas";

/**
 * POST /api/v1/seller/orders/:number/fulfil { action: confirm | pack | ship, itemIds?, courier?, trackingNumber? }
 * Applies to all of my eligible items in the order unless itemIds is given. Ship requires courier + AWB.
 */
export const POST = route<{ number: string }>({ auth: "seller" }, async ({ req, params, auth, seller }) => {
  rateLimit(`seller-fulfil:${seller!.id}`, 300, 60 * 60 * 1000);
  const input = await parseBody(req, FulfilSchema);
  return fulfilOrder(seller!, auth!.user.id, params.number, input);
});
