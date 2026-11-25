import { err, route } from "@/lib/api";
import { campaignStats } from "@/server/admin/growth/campaigns";

/** GET /api/v1/admin/campaigns/:id/stats (admin) → { totals: {impressions, clicks, spend, ctr, ecpm}, daily: [{date, impressions, clicks, spend}] } */
export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  const s = await campaignStats(params.id);
  if (!s) throw err.notFound("Campaign not found");
  return s;
});
