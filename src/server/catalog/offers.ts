import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { productCardSelect, toProductCard } from "@/server/catalog/cards";
import type { GiftTierLite, ProductCardData } from "@/types/shared";

/**
 * Offers the storefront shows: coupons (brand-scoped + site-wide) and the free-gift programme
 * (GiftTier ladder + active GiftItem minis of TBB Originals). Cached + tag-invalidated (coupons / gifts).
 */

export type CouponOffer = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: "PERCENT" | "FLAT" | "BOGO";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  brandSlug: string | null;
  brandName: string | null;
  /** sponsored brand coupon (clip to apply, billed per clip) */
  isSponsored: boolean;
  endsAt: string | null;
};

/** Live coupons: every active, in-date, not-exhausted coupon (callers pick brand / site-wide ones). */
export async function getLiveCoupons(): Promise<CouponOffer[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.coupons);
  const now = new Date();
  const rows = await db.coupon.findMany({
    where: {
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ isSponsored: "desc" }, { endsAt: "asc" }],
    select: {
      id: true, code: true, title: true, description: true, type: true, value: true, minOrder: true, maxDiscount: true, isSponsored: true, endsAt: true, usageLimit: true, usedCount: true,
      brand: { select: { slug: true, name: true, isOwn: true } },
    },
  });
  return rows
    .filter((r) => r.usageLimit == null || r.usedCount < r.usageLimit)
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      type: r.type,
      value: r.value,
      minOrder: r.minOrder,
      maxDiscount: r.maxDiscount,
      brandSlug: r.brand?.slug ?? null,
      brandName: r.brand ? (r.brand.isOwn ? "TBB Originals" : r.brand.name) : null,
      isSponsored: r.isSponsored,
      endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    }));
}

/** Coupons that apply to a brand's products: its own coupons first, then site-wide ones. */
export async function getCouponsForBrand(brandSlug: string): Promise<CouponOffer[]> {
  const all = await getLiveCoupons();
  return [...all.filter((c) => c.brandSlug === brandSlug), ...all.filter((c) => !c.brandSlug)];
}

export function couponValidity(c: Pick<CouponOffer, "endsAt">): string | null {
  if (!c.endsAt) return null;
  return new Date(c.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

// ───────────────────────────── free gifts ─────────────────────────────

export type GiftMini = {
  id: string;
  miniName: string;
  miniSize: string;
  worth: number;
  stock: number;
  /** the full-size TBB Original it comes from (photo/packshot, price, link) */
  product: ProductCardData;
};

export type GiftProgramme = {
  tiers: GiftTierLite[];
  gifts: GiftMini[];
  /** max gifts on one order (top tier) */
  maxGifts: number;
  /** combined worth of the best `maxGifts` minis */
  worthUpTo: number;
};

export async function getGiftProgramme(): Promise<GiftProgramme> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.gifts, TAGS.products);
  const [tiers, items] = await Promise.all([
    db.giftTier.findMany({ where: { isActive: true }, orderBy: { minAmount: "asc" }, select: { minAmount: true, giftCount: true } }),
    db.giftItem.findMany({
      where: { isActive: true, stock: { gt: 0 }, product: { status: "ACTIVE" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, miniName: true, miniSize: true, worth: true, stock: true, product: { select: productCardSelect } },
    }),
  ]);
  const cleanTiers = tiers.length ? tiers : [{ minAmount: 0, giftCount: 1 }];
  const maxGifts = Math.max(1, ...cleanTiers.map((t) => t.giftCount));
  const gifts = items.map((g) => ({ id: g.id, miniName: g.miniName, miniSize: g.miniSize, worth: g.worth, stock: g.stock, product: toProductCard(g.product) }));
  const worthUpTo = [...gifts].sort((a, b) => b.worth - a.worth).slice(0, maxGifts).reduce((a, g) => a + g.worth, 0);
  return { tiers: cleanTiers, gifts, maxGifts, worthUpTo };
}

/** Gifts unlocked by a cart subtotal (₹) under the active tiers. */
export function giftsFor(subtotal: number, tiers: GiftTierLite[]): number {
  return tiers.reduce((n, t) => (subtotal >= t.minAmount ? Math.max(n, t.giftCount) : n), 0);
}
