import "server-only";
import type { ServedAd } from "@/types/shared";

/**
 * AD SERVING — CONTRACT (implemented by the `ads` build agent; this is a placeholder).
 *
 * getServedAds(code, context) returns the creatives to show in slot `code` right now:
 *   live = slot.isActive && campaign.status === "APPROVED" && startsAt <= now <= endsAt && (budget === 0 || spent < budget)
 *   ordered by priority desc, then weighted rotation; house ads fill unsold positions; at most slot.positions items
 *   (H1 rotates up to 5). Context narrows targeting:
 *     H4 → targetKey = concern slug · S1/S2 → keywords match `query` · S3/P1/C1 → sponsored products
 *     P2 → productId/category · B1 → brandSlug.
 * Must be cached with 'use cache' + cacheTag(TAGS.ads, TAGS.adSlot(code)).
 */
export type AdContext = {
  query?: string;
  categorySlug?: string;
  productId?: string;
  brandSlug?: string;
  concern?: string;
  excludeProductIds?: string[];
};

export async function getServedAds(_code: string, _context: AdContext = {}): Promise<ServedAd[]> {
  return [];
}
