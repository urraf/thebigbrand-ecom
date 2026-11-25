import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { brandLiteSelect, productCardSelect, toBrandLite, toProductCard } from "@/server/catalog/cards";
import type { BrandLite, ProductCardData, ServedAd } from "@/types/shared";
import { getServedAds } from "./serve";

/**
 * Data for multi-tile zones that mix catalogue data with sponsorships:
 *  - H4 "Shop by concern": every Concern tile; sponsor = live H4 campaign for that concern, else the concern's
 *    default sponsor brand.
 *  - H7 "Featured brand stores": brands from live H7 campaigns first, then brands with an active paid store (B1).
 */

export type ConcernTile = {
  slug: string;
  name: string;
  fromPrice: number | null;
  product: ProductCardData | null;
  sponsor: BrandLite | null;
  /** the live H4 campaign behind the sponsorship (tracked link + impression) */
  ad: Pick<ServedAd, "id" | "code" | "clickUrl" | "isHouse"> | null;
};

export async function getConcernTiles(): Promise<ConcernTile[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.concerns, TAGS.products, TAGS.ads, TAGS.adSlot("H4"));

  const [concerns, ads, products] = await Promise.all([
    db.concern.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, sponsorBrand: { select: brandLiteSelect } } }),
    getServedAds("H4"),
    db.product.findMany({
      where: { status: "ACTIVE", isOwnLabel: false, stock: { gt: 0 }, concerns: { isEmpty: false } },
      select: { ...productCardSelect, concerns: true, brandId: true },
      orderBy: { soldCount: "desc" },
    }),
  ]);
  const adFor = new Map(ads.map((a) => [a.targetKey ?? "", a]));
  return concerns.map((c) => {
    const ad = adFor.get(c.slug) ?? null;
    const sponsor = ad?.brand ?? (c.sponsorBrand ? toBrandLite(c.sponsorBrand) : null);
    const pool = products.filter((p) => p.concerns.includes(c.slug));
    const hero = (sponsor && pool.find((p) => p.brand.slug === sponsor.slug)) || pool[0] || null;
    return {
      slug: c.slug,
      name: c.name,
      fromPrice: pool.length ? Math.min(...pool.map((p) => p.price)) : null,
      product: hero ? toProductCard(hero) : null,
      sponsor,
      ad: ad ? { id: ad.id, code: ad.code, clickUrl: ad.clickUrl, isHouse: ad.isHouse } : null,
    };
  });
}

export type StoreTile = {
  brand: BrandLite & { tagline: string | null };
  products: ProductCardData[];
  bestOff: number;
  ad: Pick<ServedAd, "id" | "code" | "clickUrl" | "isHouse"> | null;
};

export async function getFeaturedStores(limit = 12): Promise<StoreTile[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.brands, TAGS.products, TAGS.ads, TAGS.adSlot("H7"));

  const ads = await getServedAds("H7");
  const paidIds = ads.map((a) => a.brand?.id).filter((x): x is string => !!x);
  const now = new Date();
  const brands = await db.brand.findMany({
    where: {
      isOwn: false,
      OR: [{ id: { in: paidIds } }, { storeActive: true, OR: [{ storeActiveUntil: null }, { storeActiveUntil: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }],
    select: { ...brandLiteSelect, tagline: true },
  });
  const order = (id: string) => {
    const i = paidIds.indexOf(id);
    return i === -1 ? 1000 : i;
  };
  const list = brands.sort((a, b) => order(a.id) - order(b.id)).slice(0, limit);
  if (!list.length) return [];
  const prods = await db.product.findMany({
    where: { brandId: { in: list.map((b) => b.id) }, status: "ACTIVE" },
    orderBy: [{ isFeatured: "desc" }, { soldCount: "desc" }],
    select: { ...productCardSelect, brandId: true },
  });
  return list.map((b) => {
    const ps = prods.filter((p) => p.brandId === b.id);
    const bestOff = ps.reduce((m, p) => (p.mrp > p.price ? Math.max(m, Math.round((1 - p.price / p.mrp) * 100)) : m), 0);
    const ad = ads.find((a) => a.brand?.id === b.id) ?? null;
    return {
      brand: { ...toBrandLite(b), tagline: b.tagline },
      products: ps.slice(0, 3).map(toProductCard),
      bestOff,
      ad: ad ? { id: ad.id, code: ad.code, clickUrl: ad.clickUrl, isHouse: ad.isHouse } : null,
    };
  });
}
