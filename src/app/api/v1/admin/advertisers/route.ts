import { parseBody, parseQuery, route } from "@/lib/api";
import { advertiserInputSchema, advertiserListQuery, createAdvertiser, listAdvertisers } from "@/server/admin/growth/advertisers";

/**
 * GET  /api/v1/admin/advertisers?q&page&limit (admin) → paged advertisers with campaigns, live/pending counts, spend, payments, CTR
 * POST /api/v1/admin/advertisers (admin) { companyName, contactName, email, phone?, gstin?, brandId? } → creates a direct-deal advertiser
 */
export const GET = route({ auth: "admin" }, async ({ req }) => listAdvertisers(parseQuery(req, advertiserListQuery)));

export const POST = route({ auth: "admin" }, async ({ req, auth }) => {
  const body = await parseBody(req, advertiserInputSchema);
  return createAdvertiser(body, auth!.user.id);
});
