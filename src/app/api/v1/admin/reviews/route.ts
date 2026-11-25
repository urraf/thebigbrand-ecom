import { parseQuery, route } from "@/lib/api";
import { listReviews, ReviewListQuery, reviewStats } from "@/server/admin/core/reviews";

/** GET /api/v1/admin/reviews?q&status(=published|hidden)&rating&verified(=yes|no)&product&sort(=recent|rating|helpful)&dir&page&limit → paged + stats */
export const GET = route({ auth: "admin" }, async ({ req }) => {
  const [list, stats] = await Promise.all([listReviews(parseQuery(req, ReviewListQuery)), reviewStats()]);
  return { ...list, stats };
});
