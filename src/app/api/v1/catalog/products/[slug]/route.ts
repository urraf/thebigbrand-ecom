import { err, route } from "@/lib/api";
import { getCouponsForBrand, getGiftProgramme } from "@/server/catalog/offers";
import { getProductDetail, getProductReviews, getRecommendations } from "@/server/catalog/product";

/**
 * GET /api/v1/catalog/products/[slug] — everything the product page shows:
 *   { product (card + images, brand, category, seller, description, howToUse, ingredients, bullets, concerns, rank),
 *     reviews { count, average, histogram[5★…1★], reviews[] }, together[] (frequently bought together),
 *     similar[] (compare), offers { coupons[], gifts { tiers, gifts, maxGifts, worthUpTo } } }
 * 404 for unknown or non-ACTIVE products.
 */
export const GET = route<{ slug: string }>({ auth: "public" }, async ({ params }) => {
  const product = await getProductDetail(params.slug);
  if (!product) throw err.notFound("Product not found");
  const [reviews, recs, coupons, gifts] = await Promise.all([
    getProductReviews(product.card.id),
    getRecommendations(product.card.id),
    getCouponsForBrand(product.brand.slug),
    getGiftProgramme(),
  ]);
  return { product, reviews, together: recs.together, similar: recs.similar, offers: { coupons, gifts } };
});
