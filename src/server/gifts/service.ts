import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, type Prisma } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { productCardSelect, toProductCard } from "@/server/catalog/cards";
import { getGiftTiers } from "@/server/cart/service";
import type { GiftOption, GiftTierLite, ProductCardData } from "@/types/shared";

/**
 * FREE GIFTS — the client's key mechanic. Active GiftItems (minis of TBB Originals) + GiftTier allowances.
 * Cached for days and busted with TAGS.gifts (admin gift edits and every order placement / cancellation,
 * since gift stock moves with each order).
 */

export const giftOptionSelect = {
  id: true,
  productId: true,
  miniName: true,
  miniSize: true,
  worth: true,
  stock: true,
  product: { select: productCardSelect },
} satisfies Prisma.GiftItemSelect;

type GiftRow = Prisma.GiftItemGetPayload<{ select: typeof giftOptionSelect }>;

export function toGiftOption(g: GiftRow): GiftOption {
  return { id: g.id, productId: g.productId, miniName: g.miniName, miniSize: g.miniSize, worth: g.worth, stock: g.stock, product: toProductCard(g.product) };
}

/** Every active gift (in-stock first, then the admin's sort order). Out-of-stock gifts are kept so the picker can show them greyed out. */
export async function getActiveGifts(): Promise<GiftOption[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.gifts, TAGS.products);
  const rows = await db.giftItem.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: giftOptionSelect,
  });
  const gifts = rows.map(toGiftOption);
  return [...gifts.filter((g) => g.stock > 0), ...gifts.filter((g) => g.stock <= 0)];
}

export type GiftCatalog = { gifts: GiftOption[]; tiers: GiftTierLite[]; maxGifts: number; topWorth: number };

/** Gifts + tiers for the cart meter, the checkout picker and GET /api/v1/gifts. */
export async function getGiftCatalog(): Promise<GiftCatalog> {
  const [gifts, tiers] = await Promise.all([getActiveGifts(), getGiftTiers()]);
  const maxGifts = tiers.reduce((m, t) => Math.max(m, t.giftCount), 0);
  return { gifts, tiers, maxGifts, topWorth: topGiftWorth(gifts, maxGifts) };
}

/** Combined worth of the `n` most valuable in-stock gifts ("gifts worth up to ₹X"). */
export function topGiftWorth(gifts: GiftOption[], n: number): number {
  return gifts
    .filter((g) => g.stock > 0)
    .map((g) => g.worth)
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, n))
    .reduce((a, b) => a + b, 0);
}

/**
 * Full-size TBB Originals for the order-confirmation upsell ("Loved your free gift? Get the full size at 20% off").
 * Returns the products behind the given gift items first, then other active TBB Originals.
 */
export async function getFullSizeOriginals(giftProductIds: string[], limit = 4): Promise<ProductCardData[]> {
  const all = await getOriginals();
  const picked = new Set(giftProductIds);
  return [...all.filter((p) => picked.has(p.id)), ...all.filter((p) => !picked.has(p.id))].slice(0, limit);
}

async function getOriginals(): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.gifts);
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", stock: { gt: 0 }, OR: [{ isOwnLabel: true }, { brand: { isOwn: true } }] },
    orderBy: [{ isFeatured: "desc" }, { soldCount: "desc" }],
    take: 24,
    select: productCardSelect,
  });
  return rows.map(toProductCard);
}
