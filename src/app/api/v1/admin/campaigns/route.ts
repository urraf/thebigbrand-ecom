import { z } from "zod";
import { parseBody, parseQuery, route } from "@/lib/api";
import { campaignInputSchema, campaignListQuery, campaignSummary, createCampaign, listCampaigns } from "@/server/admin/growth/campaigns";

/**
 * GET  /api/v1/admin/campaigns?status&state&slot&advertiser&house&q&page&limit (admin)
 *      → paged list (+ `summary` with the approval queue when ?summary=1)
 *      state = delivery state: LIVE | SCHEDULED | FINISHED | BUDGET_SPENT | SLOT_PAUSED | PENDING_REVIEW | DRAFT | PAUSED | REJECTED | ENDED
 * POST /api/v1/admin/campaigns (admin) { …CampaignInput, approve?: boolean } → creates a campaign (DRAFT, or APPROVED
 *      straight away with approve=true). House campaigns (isHouse) are the client's own promos: labelled "The Big Brands", billed ₹0.
 */
export const GET = route({ auth: "admin" }, async ({ req }) => {
  const q = parseQuery(req, campaignListQuery.extend({ summary: z.enum(["1", "0"]).optional() }));
  const list = await listCampaigns(q);
  return q.summary === "1" ? { ...list, summary: await campaignSummary() } : list;
});

const CreateBody = z.intersection(campaignInputSchema, z.object({ approve: z.boolean().optional() }));

export const POST = route({ auth: "admin" }, async ({ req, auth }) => {
  const body = await parseBody(req, CreateBody);
  return createCampaign(body, auth!.user.id, { approve: body.approve });
});
