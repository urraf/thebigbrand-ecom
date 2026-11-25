import { parseBody, route } from "@/lib/api";
import { adjustmentSchema, createAdjustment } from "@/server/admin/growth/payouts";

/** POST /api/v1/admin/payouts/adjustments (superadmin) { sellerId, amount (signed ₹, ≠ 0), reason } → ADJUSTMENT ledger entry (audited) */
export const POST = route({ auth: "superadmin" }, async ({ req, auth }) => {
  const body = await parseBody(req, adjustmentSchema);
  return createAdjustment(body, auth!.user.id);
});
