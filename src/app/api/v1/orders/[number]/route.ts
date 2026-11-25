import { z } from "zod";
import { err, parseBody, rateLimit, route } from "@/lib/api";
import { cancelForCustomer, cancelSchema, getOrderDetail } from "@/server/orders/customer";

const Params = z.object({ number: z.string().trim().min(6).max(24) });

/**
 * GET  /api/v1/orders/:number  (signed in, owner only) → OrderDetail (items with per-item status / courier /
 *      tracking, free gifts, address snapshot, payments, timeline, canCancel / canPay / canReturn flags).
 * POST /api/v1/orders/:number { action: "cancel", reason? } → OrderDetail (same as POST …/cancel).
 */
export const GET = route<{ number: string }>({ auth: "user" }, async ({ params, auth }) => {
  const { number } = Params.parse(params);
  const order = await getOrderDetail(auth!.user.id, number);
  if (!order) throw err.notFound("Order not found");
  return order;
});

const ActionBody = cancelSchema.extend({ action: z.literal("cancel") });

export const POST = route<{ number: string }>({ auth: "user" }, async ({ req, params, auth }) => {
  rateLimit(`order-action:${auth!.user.id}`, 20, 60_000);
  const { number } = Params.parse(params);
  const body = await parseBody(req, ActionBody);
  return cancelForCustomer(auth!.user.id, number, body.reason);
});
