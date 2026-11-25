import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import type { AdSlotInfo } from "@/types/shared";
import { isTimeBased, rateLabel, reachFor, type SlotReach } from "@/components/ads/lib/pricing";

/**
 * Ad inventory / public rate card. Cached (everyone sees the same rate card); invalidated with TAGS.ads
 * whenever admin changes a slot (pause, rate) or a campaign.
 */

/** Rate-card row with the extra facts the Advertise page needs. */
export type AdSlotCard = AdSlotInfo & {
  description: string | null;
  bookable: boolean;
  sortOrder: number;
  /** live paid (non-house) campaigns right now */
  live: number;
  /** share of positions sold right now, 0..1 */
  fill: number;
  /** reach per position per day (live delivery stats, demo fallback when no history) */
  reach: SlotReach;
  /** true when `reach` came from real delivery stats */
  measured: boolean;
  /** flat-priced slots sell exclusive positions; performance slots rotate competing campaigns */
  exclusive: boolean;
};

const isLiveWhere = (now: Date) => ({
  status: "APPROVED" as const,
  startsAt: { lte: now },
  endsAt: { gte: now },
});

export async function listSlotCards(): Promise<AdSlotCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.ads);

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 864e5);
  const [slots, live, stats] = await Promise.all([
    db.adSlot.findMany({ orderBy: { sortOrder: "asc" } }),
    db.adCampaign.findMany({ where: { ...isLiveWhere(now), isHouse: false }, select: { slotId: true, budget: true, spent: true } }),
    db.adStatDaily.groupBy({
      by: ["campaignId"],
      where: { date: { gte: since } },
      _sum: { impressions: true, clicks: true },
      _count: { _all: true },
    }),
  ]);
  const paidStores = await db.brand.count({ where: { isOwn: false, storeActive: true, OR: [{ storeActiveUntil: null }, { storeActiveUntil: { gte: now } }] } });
  const campaignSlot = new Map(
    (await db.adCampaign.findMany({ where: { id: { in: stats.map((s) => s.campaignId) } }, select: { id: true, slotId: true } })).map((c) => [c.id, c.slotId]),
  );

  // per slot: Σ impressions / Σ campaign-days → impressions per position per day
  const agg = new Map<string, { imp: number; clk: number; days: number }>();
  for (const s of stats) {
    const slotId = campaignSlot.get(s.campaignId);
    if (!slotId) continue;
    const a = agg.get(slotId) ?? { imp: 0, clk: 0, days: 0 };
    a.imp += s._sum.impressions ?? 0;
    a.clk += s._sum.clicks ?? 0;
    a.days += s._count._all;
    agg.set(slotId, a);
  }
  const liveBySlot = new Map<string, number>();
  for (const c of live) {
    if (c.budget > 0 && c.spent >= c.budget) continue;
    liveBySlot.set(c.slotId, (liveBySlot.get(c.slotId) ?? 0) + 1);
  }

  return slots.map((s) => {
    const a = agg.get(s.id);
    const measured = !!a && a.days >= 3 && a.imp > 0;
    const reach = reachFor(s.code, measured ? { imp: Math.round(a!.imp / a!.days), ctr: a!.clk / a!.imp } : undefined);
    // B1 brand-store subscriptions are tracked on the Brand (storeActive), not as campaigns
    const liveN = s.code === "B1" ? Math.max(paidStores, liveBySlot.get(s.id) ?? 0) : (liveBySlot.get(s.id) ?? 0);
    return {
      code: s.code,
      page: s.page,
      name: s.name,
      format: s.format,
      size: s.size,
      pricingModel: s.pricingModel,
      rate: s.rate,
      rateLabel: rateLabel(s.pricingModel, s.rate),
      positions: s.positions,
      potentialMonthly: s.potentialMonthly,
      isActive: s.isActive,
      description: s.description,
      bookable: s.bookable,
      sortOrder: s.sortOrder,
      live: liveN,
      fill: s.positions > 0 ? Math.min(1, liveN / s.positions) : 0,
      reach,
      measured,
      exclusive: isTimeBased(s.pricingModel),
    };
  });
}

/** Public rate card (AdSlotInfo[]) — GET /api/v1/ads/slots and the inspector. */
export async function listSlots(): Promise<AdSlotInfo[]> {
  const cards = await listSlotCards();
  return cards.map((c) => ({
    code: c.code,
    page: c.page,
    name: c.name,
    format: c.format,
    size: c.size,
    pricingModel: c.pricingModel,
    rate: c.rate,
    rateLabel: c.rateLabel,
    positions: c.positions,
    potentialMonthly: c.potentialMonthly,
    isActive: c.isActive,
  }));
}

/** Minimal slot facts for the inspector tag on a placement. */
export type ZoneSlot = { code: string; name: string; size: string; rateLabel: string; positions: number; isActive: boolean; pricingModel: string; rate: number };

export async function getZoneSlot(code: string): Promise<ZoneSlot | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.ads, TAGS.adSlot(code));
  const s = await db.adSlot.findUnique({ where: { code } });
  if (!s) return null;
  return {
    code: s.code,
    name: s.name,
    size: s.size,
    rateLabel: rateLabel(s.pricingModel, s.rate),
    positions: s.positions,
    isActive: s.isActive,
    pricingModel: s.pricingModel,
    rate: s.rate,
  };
}
