import { err, parseBody, route } from "@/lib/api";
import { advertiserInputSchema, getAdvertiser, updateAdvertiser } from "@/server/admin/growth/advertisers";

/**
 * GET   /api/v1/admin/advertisers/:id (admin) → profile, campaigns (with delivery state), payments, monthly spend, totals
 * PATCH /api/v1/admin/advertisers/:id (admin) partial { companyName, contactName, email, phone, gstin, brandId }
 */
export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  const a = await getAdvertiser(params.id);
  if (!a) throw err.notFound("Advertiser not found");
  return a;
});

export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, advertiserInputSchema.partial());
  return updateAdvertiser(params.id, body, auth!.user.id);
});
