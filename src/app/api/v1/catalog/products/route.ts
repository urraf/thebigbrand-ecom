import { route } from "@/lib/api";
import { rawParams, searchResponse } from "@/server/catalog/api";

/**
 * GET /api/v1/catalog/products — product listing with the same filters as /api/v1/search
 *   ?q&cat&brand&concern&min&max&rating&discount&gift&stock&sort&page&limit
 *   &deals=1  → today's deals (≥15% off)       &sponsored=0 → no sponsored products pinned on page 1
 * Only ACTIVE products. Same response shape as /api/v1/search (facets included).
 */
export const GET = route({ auth: "public" }, async ({ req }) => {
  const raw = rawParams(req);
  return searchResponse(raw, { sponsored: raw.sponsored !== "0" });
});
