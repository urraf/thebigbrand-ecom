import { after } from "next/server";
import { route } from "@/lib/api";
import { rawParams, searchResponse } from "@/server/catalog/api";
import { logSearch } from "@/server/catalog/search";

/**
 * GET /api/v1/search?q&cat&brand&concern&min&max&rating&discount&gift&stock&sort&page&limit&deals
 *   brand / concern: comma-separated slugs · sort: rel|best|new|price-asc|price-desc|rating|discount
 *   → { query, total, page, pages, limit, items: ProductCard[] (sponsored ones carry `sponsored`), facets,
 *       related, loose, brandMatch, noResults, noResultsBeforeFilters }
 * Logs the query (SearchQuery) after the response on page 1.
 */
export const GET = route({ auth: "public" }, async ({ req, auth }) => {
  const data = await searchResponse(rawParams(req));
  if (data.query.q && data.page === 1) {
    const userId = auth?.user.id ?? null;
    after(() => logSearch(data.query.q, data.total, userId));
  }
  return data;
});
