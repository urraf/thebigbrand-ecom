import { err, parseBody, route } from "@/lib/api";
import { campaignInputSchema, deleteCampaign, getCampaign, updateCampaign } from "@/server/admin/growth/campaigns";

/**
 * GET   /api/v1/admin/campaigns/:id   (admin; id or CMP code) → full campaign: creative, targeting, schedule, billing,
 *       products (card data), payments, daily stats for the flight, delivery state.
 * PATCH /api/v1/admin/campaigns/:id   (admin) full CampaignInput → saves the creative/schedule/billing (ads cache invalidated).
 * DELETE /api/v1/admin/campaigns/:id  (admin) → deletes a DRAFT / REJECTED / ENDED campaign that never delivered or took payment.
 */
export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  const c = await getCampaign(params.id);
  if (!c) throw err.notFound("Campaign not found");
  return c;
});

export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, campaignInputSchema);
  const existing = await getCampaign(params.id);
  if (!existing) throw err.notFound("Campaign not found");
  return updateCampaign(existing.id, body, auth!.user.id);
});

export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, auth }) => {
  const existing = await getCampaign(params.id);
  if (!existing) throw err.notFound("Campaign not found");
  return deleteCampaign(existing.id, auth!.user.id);
});
