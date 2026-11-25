import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";

/**
 * Live "Sponsored Deal of the Day" prices (slot H10, `meta.dealPrice`), for the cart/checkout to honour.
 * CROSS-AREA HELPER: store-kit/commerce can call `getActiveDealPrices([productIds])` when pricing a cart so
 * the price advertised on the deal creative is the price charged. Only prices below the product's own price
 * are returned, and only while the deal campaign is live.
 */
export async function getActiveDealPrices(productIds?: string[]): Promise<Record<string, number>> {
  const all = await liveDeals();
  if (!productIds) return all;
  const out: Record<string, number> = {};
  for (const id of productIds) if (all[id] != null) out[id] = all[id];
  return out;
}

async function liveDeals(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.ads, TAGS.adSlot("H10"), TAGS.products);
  const now = new Date();
  const rows = await db.adCampaign.findMany({
    where: { slot: { code: "H10", isActive: true }, status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now } },
    select: { productIds: true, targetKey: true, meta: true, budget: true, spent: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.budget > 0 && r.spent >= r.budget) continue;
    const price = Number((r.meta as { dealPrice?: unknown } | null)?.dealPrice);
    const pid = r.productIds[0] ?? r.targetKey;
    if (!pid || !Number.isFinite(price) || price <= 0) continue;
    out[pid] = Math.round(price);
  }
  const ids = Object.keys(out);
  if (!ids.length) return out;
  const prods = await db.product.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, price: true } });
  const final: Record<string, number> = {};
  for (const p of prods) if (out[p.id] < p.price) final[p.id] = out[p.id];
  return final;
}
