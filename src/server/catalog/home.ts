import "server-only";
import type { ProductCardData, ServedAd } from "@/types/shared";
import { getServedAds } from "@/server/ads/serve";
import { getZoneSlot } from "@/server/ads/slots";
import { getConcernTiles, getFeaturedStores, type ConcernTile, type StoreTile } from "@/server/ads/zones";
import { getCouponWall, type WallCoupon } from "@/server/ads/coupons";
import { getCatalog, getStoreSettings } from "./data";
import { getGiftProgramme, type GiftProgramme } from "./offers";

/**
 * The homepage as data, in display order (GET /api/v1/catalog/home — the mobile app renders the same page).
 * Paid placements carry their slot code; sections with nothing live are omitted.
 */

export type HomeSection =
  | { key: string; type: "ads"; slot: string; ads: ServedAd[] }
  | { key: "concerns"; type: "concerns"; slot: "H4"; tiles: ConcernTile[] }
  | { key: "coupons"; type: "coupons"; slot: "H9"; coupons: WallCoupon[] }
  | { key: "stores"; type: "stores"; slot: "H7"; stores: StoreTile[] }
  | { key: "free-gift"; type: "gift-programme"; slot: null; programme: GiftProgramme }
  | { key: "originals"; type: "house-products"; slot: null; title: string; products: ProductCardData[] }
  | { key: "trending"; type: "trending"; slot: null; terms: string[] };

/** Full-size TBB Originals for the house banner (the products behind the free minis first). */
export async function getOriginals(limit = 6): Promise<ProductCardData[]> {
  const [gifts, snap] = await Promise.all([getGiftProgramme(), getCatalog()]);
  const fromGifts = gifts.gifts.map((g) => g.product);
  const own = snap.entries.filter((e) => e.card.isOwnLabel && !fromGifts.some((p) => p.id === e.card.id)).map((e) => e.card);
  return [...fromGifts, ...own].slice(0, limit);
}

export async function getHomeSections(): Promise<HomeSection[]> {
  const ads = (code: string) => getServedAds(code);
  const active = async (code: string) => Boolean((await getZoneSlot(code))?.isActive);
  const [h1, h2, h3, h5, h6, h8, h10, h11, tiles, h7On, h9On, programme, originals, settings] = await Promise.all([
    ads("H1"), ads("H2"), ads("H3"), ads("H5"), ads("H6"), ads("H8"), ads("H10"), ads("H11"),
    getConcernTiles(),
    active("H7"),
    active("H9"),
    getGiftProgramme(),
    getOriginals(),
    getStoreSettings(),
  ]);
  const [stores, coupons] = await Promise.all([h7On ? getFeaturedStores(12) : Promise.resolve([]), h9On ? getCouponWall(8) : Promise.resolve([])]);
  const out: HomeSection[] = [];
  const pushAds = (key: string, slot: string, list: ServedAd[]) => {
    if (list.length) out.push({ key, type: "ads", slot, ads: list });
  };
  pushAds("hero", "H1", h1);
  pushAds("spotlight", "H2", h2);
  if (tiles.length) out.push({ key: "concerns", type: "concerns", slot: "H4", tiles });
  pushAds("leaderboard", "H3", h3);
  pushAds("deal-of-the-day", "H10", h10);
  out.push({ key: "free-gift", type: "gift-programme", slot: null, programme });
  pushAds("video", "H5", h5);
  pushAds("reels", "H6", h6);
  pushAds("double-billboard", "H8", h8);
  if (coupons.length) out.push({ key: "coupons", type: "coupons", slot: "H9", coupons });
  pushAds("brand-shelf", "H11", h11);
  if (stores.length) out.push({ key: "stores", type: "stores", slot: "H7", stores });
  if (originals.length) out.push({ key: "originals", type: "house-products", slot: null, title: "TBB Originals — loved your free gift? Get the full size.", products: originals });
  out.push({ key: "trending", type: "trending", slot: null, terms: settings.trending });
  return out;
}
