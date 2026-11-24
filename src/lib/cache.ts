import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Cache tags used with `'use cache'` + `cacheTag()` in read functions, and invalidated after writes.
 * Read side:   'use cache'; cacheLife('hours'); cacheTag(TAGS.products, TAGS.product(slug))
 * Write side:  invalidate(TAGS.products, TAGS.product(slug))   // from Route Handlers / Server Actions
 */
export const TAGS = {
  products: "products",
  product: (idOrSlug: string) => `product:${idOrSlug}`,
  brands: "brands",
  brand: (slug: string) => `brand:${slug}`,
  categories: "categories",
  concerns: "concerns",
  gifts: "gifts",
  coupons: "coupons",
  reviews: (productId: string) => `reviews:${productId}`,
  ads: "ads", // any ad slot / campaign change
  adSlot: (code: string) => `ad-slot:${code}`,
  settings: "settings",
  sellers: "sellers",
} as const;

/** Expire tags immediately so admin changes (e.g. pausing an ad slot) show on the very next request. */
export function invalidate(...tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
