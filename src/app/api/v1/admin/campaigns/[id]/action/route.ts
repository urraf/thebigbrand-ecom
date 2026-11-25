import { err, parseBody, route } from "@/lib/api";
import { campaignAction, campaignActionSchema, getCampaign } from "@/server/admin/growth/campaigns";

/**
 * POST /api/v1/admin/campaigns/:id/action (admin)
 *   { action: "approve" }                      DRAFT|PENDING_REVIEW|REJECTED → APPROVED (approvedBy/At; live on the storefront at once)
 *   { action: "reject", reason }               → REJECTED (reason shown to the advertiser)
 *   { action: "pause" } / { action: "resume" } APPROVED ⇄ PAUSED
 *   { action: "end" }                          → ENDED (stops now)
 *   { action: "submit" }                       DRAFT → PENDING_REVIEW
 *   { action: "duplicate" }                    → new DRAFT copy (flight starts tomorrow) — returns the copy
 */
export const POST = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const { action, reason } = await parseBody(req, campaignActionSchema);
  const c = await getCampaign(params.id);
  if (!c) throw err.notFound("Campaign not found");
  return campaignAction(c.id, action, { reason }, auth!.user.id);
});
