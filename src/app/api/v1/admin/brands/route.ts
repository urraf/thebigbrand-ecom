import { z } from "zod";
import { parseBody, parseQuery, route } from "@/lib/api";
import { BRAND_FONTS, BrandCreate, createBrand, listBrands } from "@/server/admin/core/brands";

/**
 * GET  /api/v1/admin/brands?q  → { items: brands with product/campaign/coupon counts, fonts: wordmark font options }
 * POST /api/v1/admin/brands { name, slug?, word?, sub?, color, accent?, font?, fontWeight, textTransform, letterSpacing, italic,
 *      tagline?, description?, logoUrl?, bannerUrl?, isOwn, featured, storeActive, storeActiveUntil?, sortOrder }
 */
export const GET = route({ auth: "admin" }, async ({ req }) => {
  const { q } = parseQuery(req, z.object({ q: z.string().trim().max(60).optional() }));
  return { items: await listBrands(q), fonts: BRAND_FONTS };
});

export const POST = route({ auth: "admin" }, async ({ req, auth }) => createBrand(await parseBody(req, BrandCreate), auth!.user.id));
