import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { getRevenueReport, parseRange } from "@/server/admin/growth/revenue";

/**
 * GET /api/v1/admin/revenue?days=7|30|90  (admin)
 * → RevenueReport: daily ad revenue vs product sales, totals + previous-period totals, revenue by slot / advertiser /
 *   pricing model, impressions · clicks · CTR · eCPM, fill rate per slot, top campaigns, seller GMV & commission.
 */
const Query = z.object({ days: z.string().optional() });

export const GET = route({ auth: "admin" }, async ({ req }) => {
  const { days } = parseQuery(req, Query);
  return getRevenueReport(parseRange(days));
});
