import { route } from "@/lib/api";
import { BRAND_GROUPS, brandGroupsOf, getBrandDirectory } from "@/server/catalog/brands";

/**
 * GET /api/v1/catalog/brands → { groups: [{key,label}], brands: [{ …BrandLite, displayName, tagline, bannerUrl,
 *   followers, storeActive, productCount, avgRating, ratingCount, categories, groups, top: ProductCard[] }] }
 */
export const GET = route({ auth: "public" }, async () => {
  const brands = await getBrandDirectory();
  return {
    groups: BRAND_GROUPS.map(([key, label]) => ({ key, label })),
    brands: brands.map((b) => ({ ...b, groups: brandGroupsOf(b) })),
  };
});
