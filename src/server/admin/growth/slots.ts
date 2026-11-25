import "server-only";
import { z } from "zod";
import { db, type AdSlot } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { deliveryState, liveWhere, STATE_LABEL, STATE_TONE, type DeliveryState } from "./state";
import {
  addDaysKey,
  asJson,
  dateColKey,
  dayKeys,
  daysInMonth,
  keyToDateCol,
  monthStartKey,
  rateLabel,
  ratio,
  todayKey,
} from "./util";

/**
 * ADS MANAGER — the ad inventory (rate card) and its controls.
 * Pausing a slot hides every creative in it on the website & apps on the next request (invalidate TAGS.ads + TAGS.adSlot).
 * Rate changes apply to new bookings; running campaigns keep the rate they were sold at.
 */

export const PAGE_LABEL: Record<string, string> = {
  home: "Homepage",
  search: "Search results",
  product: "Product pages",
  cart: "Cart",
  success: "Order confirmation",
  brand: "Brand stores",
  offline: "Delivery box",
};

export type SlotRow = {
  id: string;
  code: string;
  page: string;
  pageLabel: string;
  name: string;
  format: string;
  size: string;
  description: string | null;
  pricingModel: AdSlot["pricingModel"];
  rate: number;
  rateLabel: string;
  positions: number;
  potentialMonthly: number;
  isActive: boolean;
  bookable: boolean;
  liveCount: number; // paid campaigns serving now
  houseLive: number;
  pendingCount: number;
  liveBrands: string[];
  fill: number; // paid live / positions, 0..1
  mtdRevenue: number;
  viewUrl: string | null;
};

export type InventorySummary = {
  slots: number;
  liveSlots: number;
  mtdRevenue: number;
  projectedMonth: number;
  potentialMonthly: number;
  weightedFill: number;
  unsoldMonthly: number;
  monthStart: string;
  today: string;
};

/** Storefront URL where a slot can be seen (null for the printed in-box insert). */
export async function slotViewUrls(): Promise<Record<string, string | null>> {
  const [product, brand] = await Promise.all([
    db.product.findFirst({ where: { status: "ACTIVE", stock: { gt: 0 } }, orderBy: { soldCount: "desc" }, select: { slug: true } }),
    db.brand.findFirst({ where: { storeActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true } }).then(
      (b) => b ?? db.brand.findFirst({ where: { isOwn: false }, orderBy: { sortOrder: "asc" }, select: { slug: true } }),
    ),
  ]);
  return {
    home: "/",
    search: "/s?q=serum",
    product: product ? `/p/${product.slug}` : "/",
    cart: "/cart",
    success: "/account/orders",
    brand: brand ? `/brand/${brand.slug}` : "/brands",
    offline: null,
  };
}

export async function listSlots(now = new Date()): Promise<{ slots: SlotRow[]; summary: InventorySummary }> {
  const today = todayKey(now);
  const monthStart = monthStartKey(now);
  const [slots, live, pending, mtd, urls] = await Promise.all([
    db.adSlot.findMany({ orderBy: { sortOrder: "asc" } }),
    db.adCampaign.findMany({
      where: liveWhere(now),
      select: { slotId: true, isHouse: true, budget: true, spent: true, brand: { select: { name: true } }, advertiser: { select: { companyName: true } } },
    }),
    db.adCampaign.groupBy({ by: ["slotId"], where: { status: "PENDING_REVIEW" }, _count: true }),
    db.$queryRaw<{ slotId: string; spend: number }[]>`
      SELECT c."slotId" AS "slotId", COALESCE(SUM(s.spend), 0)::float8 AS spend
      FROM "AdStatDaily" s JOIN "AdCampaign" c ON c.id = s."campaignId"
      WHERE s.date >= ${keyToDateCol(monthStart)}::date
      GROUP BY c."slotId"`,
    slotViewUrls(),
  ]);

  const mtdBySlot = new Map(mtd.map((r) => [r.slotId, Number(r.spend)]));
  const pendBySlot = new Map(pending.map((r) => [r.slotId, r._count]));

  const rows: SlotRow[] = slots.map((s) => {
    const mine = live.filter((c) => c.slotId === s.id && (c.budget === 0 || c.spent < c.budget));
    const paid = mine.filter((c) => !c.isHouse);
    return {
      id: s.id,
      code: s.code,
      page: s.page,
      pageLabel: PAGE_LABEL[s.page] ?? s.page,
      name: s.name,
      format: s.format,
      size: s.size,
      description: s.description,
      pricingModel: s.pricingModel,
      rate: s.rate,
      rateLabel: rateLabel(s.pricingModel, s.rate),
      positions: s.positions,
      potentialMonthly: s.potentialMonthly,
      isActive: s.isActive,
      bookable: s.bookable,
      liveCount: paid.length,
      houseLive: mine.length - paid.length,
      pendingCount: pendBySlot.get(s.id) ?? 0,
      liveBrands: [...new Set(paid.map((c) => c.brand?.name ?? c.advertiser?.companyName ?? "Brand"))],
      fill: Math.min(1, ratio(paid.length, s.positions)),
      mtdRevenue: Math.round(mtdBySlot.get(s.id) ?? 0),
      viewUrl: urls[s.page] ?? null,
    };
  });

  const mtdRevenue = rows.reduce((t, r) => t + r.mtdRevenue, 0);
  const potentialMonthly = rows.reduce((t, r) => t + r.potentialMonthly, 0);
  const weightedFill = potentialMonthly ? rows.reduce((t, r) => t + r.fill * r.potentialMonthly, 0) / potentialMonthly : 0;
  // projection uses complete days so far this month (stats for today arrive with the daily job)
  const elapsed = Math.max(1, Number(today.slice(8, 10)) - 1);
  return {
    slots: rows,
    summary: {
      slots: rows.length,
      liveSlots: rows.filter((r) => r.isActive).length,
      mtdRevenue,
      projectedMonth: Math.round((mtdRevenue / elapsed) * daysInMonth(today)),
      potentialMonthly,
      weightedFill,
      unsoldMonthly: Math.round(rows.reduce((t, r) => t + (r.isActive ? r.potentialMonthly * (1 - r.fill) : r.potentialMonthly), 0)),
      monthStart,
      today,
    },
  };
}

// ───────────────────────────── slot detail ─────────────────────────────

export type SlotCampaignRow = {
  id: string;
  code: string;
  name: string;
  headline: string;
  brandName: string | null;
  advertiser: string | null;
  isHouse: boolean;
  status: string;
  state: DeliveryState;
  stateLabel: string;
  tone: string;
  startsAt: string;
  endsAt: string;
  rate: number;
  pricingModel: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  priority: number;
  weight: number;
};

export type SlotDaily = { date: string; impressions: number; clicks: number; spend: number; campaigns: number };

export async function getSlotDetail(code: string, now = new Date()) {
  const slot = await db.adSlot.findUnique({ where: { code } });
  if (!slot) return null;
  const today = todayKey(now);
  const start = addDaysKey(today, -29);
  const [campaigns, stats, urls] = await Promise.all([
    db.adCampaign.findMany({
      where: { slotId: slot.id },
      orderBy: [{ startsAt: "desc" }],
      include: { brand: { select: { name: true } }, advertiser: { select: { companyName: true } } },
    }),
    db.adStatDaily.findMany({
      where: { campaign: { slotId: slot.id }, date: { gte: keyToDateCol(start), lte: keyToDateCol(today) } },
      select: { date: true, impressions: true, clicks: true, spend: true, campaignId: true },
    }),
    slotViewUrls(),
  ]);

  const byDay = new Map<string, SlotDaily>(dayKeys(start, today).map((k) => [k, { date: k, impressions: 0, clicks: 0, spend: 0, campaigns: 0 }]));
  for (const s of stats) {
    const d = byDay.get(dateColKey(s.date));
    if (!d) continue;
    d.impressions += s.impressions;
    d.clicks += s.clicks;
    d.spend += s.spend;
    if (s.impressions > 0) d.campaigns += 1;
  }

  const order: Record<DeliveryState, number> = {
    LIVE: 0,
    SLOT_PAUSED: 1,
    BUDGET_SPENT: 2,
    PENDING_REVIEW: 3,
    SCHEDULED: 4,
    PAUSED: 5,
    DRAFT: 6,
    FINISHED: 7,
    ENDED: 8,
    REJECTED: 9,
  };
  const rows: SlotCampaignRow[] = campaigns
    .map((c) => {
      const state = deliveryState({ ...c, slot }, now);
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        headline: c.headline,
        brandName: c.brand?.name ?? null,
        advertiser: c.advertiser?.companyName ?? null,
        isHouse: c.isHouse,
        status: c.status,
        state,
        stateLabel: STATE_LABEL[state],
        tone: STATE_TONE[state],
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        rate: c.rate,
        pricingModel: c.pricingModel,
        budget: c.budget,
        spent: Math.round(c.spent),
        impressions: c.impressions,
        clicks: c.clicks,
        priority: c.priority,
        weight: c.weight,
      };
    })
    .sort((a, b) => order[a.state] - order[b.state]);

  const daily = [...byDay.values()].map((d) => ({ ...d, spend: Math.round(d.spend) }));
  const liveRows = rows.filter((r) => r.state === "LIVE" || r.state === "SLOT_PAUSED");
  const paidLive = liveRows.filter((r) => !r.isHouse).length;
  return {
    slot: {
      ...slot,
      pageLabel: PAGE_LABEL[slot.page] ?? slot.page,
      rateLabel: rateLabel(slot.pricingModel, slot.rate),
      viewUrl: urls[slot.page] ?? null,
    },
    campaigns: rows,
    daily,
    totals: {
      revenue30: daily.reduce((t, d) => t + d.spend, 0),
      impressions30: daily.reduce((t, d) => t + d.impressions, 0),
      clicks30: daily.reduce((t, d) => t + d.clicks, 0),
      liveNow: liveRows.length,
      paidLive,
      fill: Math.min(1, ratio(paidLive, slot.positions)),
      pending: rows.filter((r) => r.state === "PENDING_REVIEW").length,
    },
  };
}

// ───────────────────────────── updates ─────────────────────────────

export const slotUpdateSchema = z
  .object({
    rate: z.coerce.number().positive("Rate must be more than ₹0").max(10_000_000).optional(),
    isActive: z.boolean().optional(),
    positions: z.coerce.number().int().min(1).max(50).optional(),
    bookable: z.boolean().optional(),
    potentialMonthly: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type SlotUpdate = z.infer<typeof slotUpdateSchema>;

export async function updateSlot(code: string, input: SlotUpdate, actorId: string) {
  const slot = await db.adSlot.findUnique({ where: { code } });
  if (!slot) throw err.notFound("Ad slot not found");
  const data: SlotUpdate = { ...input };
  if (data.rate !== undefined) data.rate = Math.round(data.rate * 100) / 100;
  const updated = await db.adSlot.update({ where: { code }, data });
  invalidate(TAGS.ads, TAGS.adSlot(code));

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof SlotUpdate)[]) {
    if (slot[k] !== updated[k]) changes[k] = { from: slot[k], to: updated[k] };
  }
  const action =
    input.isActive === false && slot.isActive ? "slot.pause" : input.isActive === true && !slot.isActive ? "slot.resume" : "slot.update";
  await audit(actorId, action, "AdSlot", slot.id, asJson({ code, changes }));
  return { ...updated, rateLabel: rateLabel(updated.pricingModel, updated.rate) };
}
