import { z } from "zod";
import { err, rateLimit, route } from "@/lib/api";
import { cancelForCustomer, cancelSchema } from "@/server/orders/customer";

const Params = z.object({ number: z.string().trim().min(6).max(24) });

/**
 * POST /api/v1/orders/:number/cancel { reason? }  (signed in, owner only; body optional) → OrderDetail
 * Allowed while unpaid, or while every item is still Placed / Confirmed / Packed. Restores product stock
 * (order lifecycle), free-gift stock and the coupon use. Prepaid orders show a refund note.
 */
export const POST = route<{ number: string }>({ auth: "user" }, async ({ req, params, auth }) => {
  rateLimit(`order-action:${auth!.user.id}`, 20, 60_000);
  const { number } = Params.parse(params);
  const text = (await req.text()).trim();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw err.badRequest("Request body must be valid JSON");
    }
  }
  const body = cancelSchema.parse(raw);
  return cancelForCustomer(auth!.user.id, number, body.reason);
});
