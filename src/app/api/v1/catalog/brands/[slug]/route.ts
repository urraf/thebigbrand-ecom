import { z } from "zod";
import { err, parseQuery, route } from "@/lib/api";
import { getBrandStore } from "@/server/catalog/brands";
import { getLiveCoupons } from "@/server/catalog/offers";

const query = z.object({ tab: z.enum(["all", "best", "new", "price"]).default("all") });

/**
 * GET /api/v1/catalog/brands/[slug]?tab=all|best|new|price — brand store:
 *   { brand, products: ProductCard[], bestIds, concerns, coupons (this brand's live coupons), similar }
 */
export const GET = route<{ slug: string }>({ auth: "public" }, async ({ req, params }) => {
  const { tab } = parseQuery(req, query);
  const store = await getBrandStore(params.slug.toLowerCase(), tab);
  if (!store) throw err.notFound("Brand not found");
  const coupons = (await getLiveCoupons()).filter((c) => c.brandSlug === store.brand.slug);
  return { ...store, coupons };
});
