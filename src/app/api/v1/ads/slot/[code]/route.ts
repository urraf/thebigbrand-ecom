import { z } from "zod";
import { err, parseQuery, route } from "@/lib/api";
import { getZone } from "@/server/ads/serve";

/**
 * GET /api/v1/ads/slot/[code]?query=&categorySlug=&productId=&brandSlug=&concern=&exclude=id1,id2
 *   → { slot: {code,name,size,rateLabel,positions,isActive,…}, ads: ServedAd[] }
 * The creatives the mobile apps should render in a placement right now (same serving rules as the web).
 * Report impressions/clicks with POST /api/v1/ads/events (or open ad.clickUrl, which records the click).
 */
const Query = z.object({
  query: z.string().max(120).optional(),
  q: z.string().max(120).optional(),
  categorySlug: z.string().max(80).optional(),
  productId: z.string().max(40).optional(),
  brandSlug: z.string().max(80).optional(),
  concern: z.string().max(40).optional(),
  exclude: z.string().max(2000).optional(),
});

export const GET = route<{ code: string }>({ auth: "public" }, async ({ req, params }) => {
  const code = params.code.toUpperCase();
  if (!/^[A-Z]\d{1,2}$/.test(code)) throw err.notFound("Unknown placement");
  const q = parseQuery(req, Query);
  const zone = await getZone(code, {
    query: q.query ?? q.q,
    categorySlug: q.categorySlug,
    productId: q.productId,
    brandSlug: q.brandSlug,
    concern: q.concern,
    excludeProductIds: q.exclude ? q.exclude.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
  });
  if (!zone.slot) throw err.notFound("Unknown placement");
  return zone;
});
