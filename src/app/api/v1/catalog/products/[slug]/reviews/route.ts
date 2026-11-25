import { z } from "zod";
import { err, parseQuery, route } from "@/lib/api";
import { getProductDetail, getProductReviews } from "@/server/catalog/product";

const query = z.object({
  sort: z.enum(["top", "recent"]).default("top"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** GET /api/v1/catalog/products/[slug]/reviews?sort=top|recent&limit=20 → { count, average, histogram, reviews } */
export const GET = route<{ slug: string }>({ auth: "public" }, async ({ req, params }) => {
  const q = parseQuery(req, query);
  const product = await getProductDetail(params.slug);
  if (!product) throw err.notFound("Product not found");
  return getProductReviews(product.card.id, { sort: q.sort, limit: q.limit });
});
