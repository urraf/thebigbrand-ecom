import "server-only";
import type { ProductCardData, ServedAd } from "@/types/shared";
import type { SearchState } from "@/components/catalog/search-state";
import { getServedAds, type AdContext } from "@/server/ads/serve";

/**
 * Sponsored products (ad slot S3) for a results page. The ads engine targets by query / category / brand /
 * concern; the results page then keeps only the ones that also match the shopper's search + filters
 * (searchCatalog's `pin`), so a sponsored listing never breaks a filter the shopper set.
 */
export type SponsoredItem = { ad: ServedAd; product: ProductCardData };

export function adContextFor(st: SearchState): AdContext {
  return {
    query: st.q || undefined,
    categorySlug: st.cat || undefined,
    brandSlug: st.brands.length === 1 ? st.brands[0] : undefined,
    concern: st.concerns.length === 1 ? st.concerns[0] : undefined,
  };
}

export async function sponsoredForSearch(st: SearchState, code: "S3" | "P1" = "S3", extra: AdContext = {}): Promise<SponsoredItem[]> {
  const ads = await getServedAds(code, { ...adContextFor(st), ...extra });
  const seen = new Set<string>();
  const out: SponsoredItem[] = [];
  for (const ad of ads)
    for (const product of ad.products) {
      if (seen.has(product.id) || product.stock <= 0) continue;
      seen.add(product.id);
      out.push({ ad, product });
    }
  return out;
}
