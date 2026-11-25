/**
 * ADS UI — public components for every area (owner: ads).
 *
 * ┌ <AdZone code="H1" context={…} className? variant? />  (async Server Component)
 * │  Renders the right creative for the slot, wrapped in the "Show ad slots" inspector wrapper (.pz-slot
 * │  [data-slot] + code/size/rate tag), with tracked links (/api/v1/ads/click/…) and impression tracking.
 * │  Renders nothing when the slot is paused or has no live creatives. Cached ('use cache', 1-minute
 * │  revalidation, busted by admin changes) — safe in a static shell, no <Suspense> needed.
 * │
 * │  Home (full-width sections, each with its own `.wrap` + top margin; place them as siblings in <main>):
 * │    H1  hero billboard carousel — put <AdZone code="H2"/> right after it: the spotlight cards overlap it
 * │    H2  brand spotlight cards (+ "Advertise with us" note)       H3  leaderboard strip
 * │    H4  "Shop by concern" tiles with "Presented by" sponsors (tiles still render, unsponsored, if H4 is paused)
 * │        · with context.concern → a compact "Presented by <brand>" chip for a concern page header
 * │    H5  video billboard (meta.scenes photos as a muted spot, or a real <video> when videoUrl is set)
 * │    H6  creator reels (meta.creator / handle / views / colors)    H7  featured brand stores
 * │    H8  double billboard                                          H9  brand coupon wall (clip → POST /api/v1/ads/coupons/[id]/clip)
 * │    H10 sponsored deal of the day (no wrap — place it in your own row, e.g. next to the free-gift promo)
 * │    H11 sponsored brand shelf
 * │  Search:  S2 headline banner (context {query, categorySlug, brandSlug, concern}) · S4 in-grid native tile
 * │           (a grid cell) · S3 sponsored products rail (prefer <SponsoredProductCards> to interleave in a grid)
 * │  Product: P1 related sponsored products rail (context {productId}) · P2 buy-box ad (context {productId, categorySlug})
 * │  Cart:    C1 "Add before checkout" rail (context {excludeProductIds: ids in cart}; props `cartSubtotal`,
 * │           `nextGiftAt` optional → "unlocks a gift" hint)  ·  Thank-you: C2 banner
 * │  Brand:   B1 brand store banner (context {brandSlug})          X1 is offline (renders nothing)
 * │  variant: "grid" for S3/P1/C1 renders a 4-up grid instead of a rail.
 * │
 * ├ <SponsoredProductCards code="S3" context={{ query }} limit? compact? />
 * │  Just the sponsored product cards (each in its own .pz-slot + tracking), as siblings — drop them straight
 * │  into a results grid (e.g. positions 1–2 and 7). Same serving rules as AdZone S3.
 * ├ <SponsoredCard ad product slot /> · sponsoredItems(ads)    for fully custom layouts with getServedAds()
 * ├ <AdInspector />  "Show ad slots" pill + panel (client), mounted once in the store layout; also starts the
 * │  impression tracker.
 * └ Labels: <ZnTag ad />, <SpLabel />, <HouseTag />           Helpers: trackedHref(ad, "/p/slug"), trackProps(ad)
 *
 * Server data: getServedAds(code, context) / getZone(code, context) from "@/server/ads/serve".
 */
import type { ReactNode } from "react";
import type { AdContext } from "@/server/ads/serve";
import { getZone } from "@/server/ads/serve";
import { getZoneSlot } from "@/server/ads/slots";
import { getConcernTiles, getFeaturedStores } from "@/server/ads/zones";
import { getCouponWall } from "@/server/ads/coupons";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import {
  ConcernsZone,
  CouponWallZone,
  DealZone,
  DoubleBillboardZone,
  HeroZone,
  LeaderboardZone,
  ReelsZone,
  ShelfZone,
  SpotlightZone,
  StoresZone,
  VideoZone,
} from "./home";
import { BuyBoxZone, NativeTileZone, PresentedByZone, SearchHeadlineZone, SponsoredCard, SponsoredRailZone, ThankYouZone, sponsoredItems } from "./commerce";
import { ZoneTracker } from "./client/tracker";
import "@/styles/ads/zones.css";

export { AdInspector } from "./client/inspector";
export { SponsoredCard, sponsoredItems } from "./commerce";
export { HouseTag, SpLabel, ZnTag, trackProps } from "./parts";
export { trackedHref, clickUrlFor } from "./lib/links";

export type AdZoneProps = {
  code: string;
  context?: AdContext;
  className?: string;
  /** "grid" for S3/P1/C1 (4-up grid instead of a rail) */
  variant?: string;
  /** S3/P1/C1: override the section title / subtitle */
  title?: string;
  subtitle?: string;
  /** C1: cart subtotal (₹) and the next free-gift threshold, for the "unlocks a gift" hint */
  cartSubtotal?: number;
  nextGiftAt?: { minAmount: number; giftCount: number } | null;
};

export async function AdZone({ code, context, className, variant, title, subtitle, cartSubtotal, nextGiftAt }: AdZoneProps) {
  const c = String(code || "").toUpperCase();

  if (c === "H4" && !context?.concern) {
    const [tiles, slot] = await Promise.all([getConcernTiles(), getZoneSlot("H4")]);
    if (!tiles.length) return null;
    return (
      <>
        <ConcernsZone tiles={tiles} slot={slot} className={className} />
        <ZoneTracker />
      </>
    );
  }
  if (c === "H7") {
    const slot = await getZoneSlot("H7");
    if (!slot?.isActive) return null;
    const tiles = await getFeaturedStores(slot.positions || 12);
    if (!tiles.length) return null;
    return (
      <>
        <StoresZone tiles={tiles} slot={slot} className={className} />
        <ZoneTracker />
      </>
    );
  }
  if (c === "H9") {
    const slot = await getZoneSlot("H9");
    if (!slot?.isActive) return null;
    const coupons = await getCouponWall(slot.positions || 8);
    if (!coupons.length) return null;
    return <CouponWallZone coupons={coupons} slot={slot} className={className} />;
  }
  if (c === "X1") return null;

  const { slot, ads } = await getZone(c, context);
  if (!slot || !slot.isActive || !ads.length) return null;
  const first = ads[0];

  let body: ReactNode = null;
  switch (c) {
    case "H1":
      body = <HeroZone ads={ads} slot={slot} className={className} />;
      break;
    case "H2":
      body = <SpotlightZone ads={ads} slot={slot} className={className} />;
      break;
    case "H3":
      body = <LeaderboardZone ad={first} slot={slot} className={className} />;
      break;
    case "H4":
      body = <PresentedByZone ad={first} slot={slot} className={className} />;
      break;
    case "H5":
      body = <VideoZone ad={first} slot={slot} className={className} />;
      break;
    case "H6":
      body = <ReelsZone ads={ads} slot={slot} className={className} />;
      break;
    case "H8":
      body = <DoubleBillboardZone ads={ads} slot={slot} className={className} />;
      break;
    case "H10":
      body = <DealZone ad={first} slot={slot} className={className} />;
      break;
    case "H11":
      body = <ShelfZone ad={first} slot={slot} className={className} />;
      break;
    case "S1":
    case "S2":
      body = <SearchHeadlineZone ad={first} slot={slot} className={className} />;
      break;
    case "S4":
      body = <NativeTileZone ad={first} slot={slot} className={className} />;
      break;
    case "S3":
    case "P1":
    case "C1": {
      let hint: ReactNode = null;
      if (c === "C1" && cartSubtotal != null && nextGiftAt && nextGiftAt.minAmount > cartSubtotal) {
        const gap = nextGiftAt.minAmount - cartSubtotal;
        const unlocks = sponsoredItems(ads).some((x) => x.product.price >= gap);
        hint = (
          <p className="zn-c1-hint">
            <Icon name="gift" />
            <span>
              You&rsquo;re <b>₹{gap.toLocaleString("en-IN")}</b> away from <b>{nextGiftAt.giftCount} free gifts</b>
              {unlocks ? ` — any add-on of ₹${gap.toLocaleString("en-IN")} or more gets you there.` : " — add a little more to pick another TBB Originals mini."}
            </span>
          </p>
        );
      }
      body = <SponsoredRailZone ads={ads} slot={slot} className={className} layout={variant === "grid" ? "grid" : "rail"} title={title} subtitle={subtitle} hint={hint} />;
      break;
    }
    case "P2":
      body = <BuyBoxZone ad={first} slot={slot} className={className} />;
      break;
    case "C2":
      body = <ThankYouZone ad={first} slot={slot} className={className} />;
      break;
    case "B1":
      body = <LeaderboardZone ad={first} slot={slot} className={cx("zn-b1", className)} />;
      break;
    default:
      body = <LeaderboardZone ad={first} slot={slot} className={className} />;
  }
  return (
    <>
      {body}
      <ZoneTracker />
    </>
  );
}

/**
 * Sponsored product cards only (no section), as siblings for a results grid. Each card sits in its own
 * `.pz-slot.slot-card` wrapper with a tracked link and impression tracking.
 */
export async function SponsoredProductCards({ code = "S3", context, limit, compact }: { code?: "S3" | "P1" | "C1"; context?: AdContext; limit?: number; compact?: boolean }) {
  const { slot, ads } = await getZone(code, context);
  if (!slot || !slot.isActive) return null;
  const items = sponsoredItems(ads).slice(0, limit ?? slot.positions);
  if (!items.length) return null;
  return (
    <>
      {items.map(({ ad, product }) => (
        <SponsoredCard key={product.id} ad={ad} product={product} slot={slot} compact={compact} />
      ))}
      <ZoneTracker />
    </>
  );
}

