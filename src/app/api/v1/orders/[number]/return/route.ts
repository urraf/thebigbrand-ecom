import { z } from "zod";
import { parseBody, rateLimit, route } from "@/lib/api";
import { requestReturn, returnSchema } from "@/server/orders/customer";

const Params = z.object({ number: z.string().trim().min(6).max(24) });

/**
 * POST /api/v1/orders/:number/return { itemIds: string[], reason: "DAMAGED"|"WRONG_ITEM"|"NOT_AS_DESCRIBED"|
 * "QUALITY"|"REACTION"|"OTHER", note? }  (signed in, owner only) → OrderDetail
 * Records a return request for delivered items within 7 days (timeline event + admin audit entry); the admin
 * team arranges pickup and completes the return.
 */
export const POST = route<{ number: string }>({ auth: "user" }, async ({ req, params, auth }) => {
  rateLimit(`order-action:${auth!.user.id}`, 20, 60_000);
  const { number } = Params.parse(params);
  return requestReturn(auth!.user.id, number, await parseBody(req, returnSchema));
});
