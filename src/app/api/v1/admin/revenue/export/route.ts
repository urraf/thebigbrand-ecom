import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { getRevenueReport, parseRange, REVENUE_EXPORTS, revenueCsv } from "@/server/admin/growth/revenue";
import { csvResponse } from "@/server/admin/growth/util";
import { audit } from "@/lib/audit";

/** GET /api/v1/admin/revenue/export?days=30&type=daily|slots|advertisers|campaigns|sellers (admin) → text/csv download */
const Query = z.object({ days: z.string().optional(), type: z.enum(REVENUE_EXPORTS).default("daily") });

export const GET = route({ auth: "admin" }, async ({ req, auth }) => {
  const q = parseQuery(req, Query);
  const report = await getRevenueReport(parseRange(q.days));
  const { filename, csv } = revenueCsv(report, q.type);
  await audit(auth!.user.id, "revenue.export", "Report", q.type, { days: report.days });
  return csvResponse(filename, csv);
});
