import { z } from "zod";
import { parseBody, parseQuery, route } from "@/lib/api";
import { createPayout, getPayoutsOverview, PAYOUT_STATUSES, payoutCreateSchema } from "@/server/admin/growth/payouts";

/**
 * GET  /api/v1/admin/payouts?status&sellerId (admin) → { balances (per seller: sales, commission, refunds, ad spend,
 *      adjustments, paid out, balance, reserved, available), payouts (history), summary }
 * POST /api/v1/admin/payouts (superadmin) { sellerId, amount, note?, periodStart?, periodEnd? } → PENDING payout
 *      (amount ≤ available balance = ledger balance − open payouts)
 */
const Query = z.object({ status: z.enum(PAYOUT_STATUSES).optional(), sellerId: z.string().trim().max(40).optional() });

export const GET = route({ auth: "admin" }, async ({ req }) => getPayoutsOverview(parseQuery(req, Query)));

export const POST = route({ auth: "superadmin" }, async ({ req, auth }) => {
  const body = await parseBody(req, payoutCreateSchema);
  return createPayout(body, auth!.user.id);
});
