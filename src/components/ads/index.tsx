/**
 * ADS UI — CONTRACT (implemented by the `ads` build agent; these are placeholders so other areas compile).
 *
 *   <AdZone code="H1" />                                   home billboard carousel
 *   <AdZone code="S2" context={{ query, categorySlug }} />  search headline banner
 *   <AdZone code="P1" context={{ productId }} />            sponsored related products rail
 *
 * AdZone is an async Server Component: it calls getServedAds(code, context), renders the right creative
 * for that slot (billboard, spotlight cards, leaderboard, video, reels, double billboard, coupon wall,
 * deal of the day, brand shelf, search headline, native tile, sponsored rail, thank-you banner…),
 * wraps it in the slot inspector wrapper (data-slot, rate tag) and adds impression/click tracking.
 * It renders nothing when the slot is paused or has no live creatives.
 */
import type { AdContext } from "@/server/ads/serve";

export type AdZoneProps = { code: string; context?: AdContext; className?: string; variant?: string };

export async function AdZone(_props: AdZoneProps) {
  return null;
}

/** "Show ad slots" demo inspector toggle + panel (client). Mounted once in the store layout. */
export function AdInspector() {
  return null;
}
