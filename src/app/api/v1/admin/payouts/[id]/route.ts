import { parseBody, route } from "@/lib/api";
import { payoutUpdateSchema, updatePayout } from "@/server/admin/growth/payouts";

/**
 * PATCH /api/v1/admin/payouts/:id (superadmin) { status: "PROCESSING" | "PAID" | "FAILED", reference?, note? }
 *   PENDING → PROCESSING → PAID (bank UTR `reference` required; writes the PAYOUT ledger debit) · PENDING/PROCESSING → FAILED
 */
export const PATCH = route<{ id: string }>({ auth: "superadmin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, payoutUpdateSchema);
  return updatePayout(params.id, body, auth!.user.id);
});
