import "server-only";
import { db, type PricingModel } from "@/lib/db";
import {
  addDaysKey,
  dateColKey,
  dayKeys,
  istDayKey,
  keyToDateCol,
  keyToIstStart,
  ratio,
  todayKey,
  toCsv,
} from "./util";

/**
 * REVENUE REPORT — the money view of the marketplace for /admin/revenue and GET /api/v1/admin/revenue.
 *  - Ad revenue  = Σ AdStatDaily.spend (billed per day by the ads engine; house campaigns bill ₹0).
 *  - Product sales = Σ (subtotal − coupon discount) of placed orders that were not cancelled / refunded / returned,
 *    bucketed by the IST day the order was placed. Shipping & COD fees are excluded.
 *  - Seller GMV = Σ line totals of seller items on those orders (cancelled / returned items excluded);
 *    commission accrued = Σ OrderItem.commissionAmt; commission earned = COMMISSION_DEBIT ledger entries (posted on delivery).
 * Every figure covers the selected window and is compared with the window of the same length just before it.
 */

export const REVENUE_RANGES = [7, 30, 90] as const;
export type RevenueRange = (typeof REVENUE_RANGES)[number];

export type DailyPoint = { date: string; ad: number; sales: number; impressions: number; clicks: number; orders: number };

export type SlotRevenue = {
  code: string;
  name: string;
  page: string;
  pricingModel: PricingModel;
  isActive: boolean;
  positions: number;
  potentialMonthly: number;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  ecpm: number;
  campaigns: number; // paid campaigns that served in the window
  fill: number; // 0..1 average share of positions sold on days with delivery data
};

export type AdvertiserRevenue = {
  id: string | null;
  name: string;
  brandName: string | null;
  revenue: number;
  impressions: number;
  clicks: number;
  campaigns: number;
};

export type ModelRevenue = { model: PricingModel; revenue: number; impressions: number; clicks: number; campaigns: number };

export type CampaignRevenue = {
  id: string;
  code: string;
  name: string;
  headline: string;
  slotCode: string;
  slotName: string;
  advertiser: string | null;
  brandName: string | null;
  isHouse: boolean;
  status: string;
  pricingModel: PricingModel;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  ecpm: number;
};

export type SellerRevenue = {
  id: string;
  name: string;
  status: string;
  commissionPct: number;
  gmv: number;
  items: number;
  commissionAccrued: number;
  commissionEarned: number;
};

export type RevenueTotals = {
  ad: number;
  sales: number;
  total: number;
  adShare: number;
  orders: number;
  aov: number;
  impressions: number;
  clicks: number;
  ctr: number;
  ecpm: number;
  houseImpressions: number;
  sellerGmv: number;
  commissionAccrued: number;
  commissionEarned: number;
};

export type RevenueReport = {
  days: number;
  start: string;
  end: string;
  lastStatDate: string | null;
  daily: DailyPoint[];
  totals: RevenueTotals;
  previous: Pick<RevenueTotals, "ad" | "sales" | "total" | "impressions" | "clicks" | "orders" | "sellerGmv">;
  bySlot: SlotRevenue[];
  byAdvertiser: AdvertiserRevenue[];
  byModel: ModelRevenue[];
  topCampaigns: CampaignRevenue[];
  sellers: SellerRevenue[];
  potentialMonthly: number;
  weightedFill: number;
};

const EXCLUDED_ORDER = ["PENDING_PAYMENT", "CANCELLED", "REFUNDED", "RETURNED"] as const;
const EXCLUDED_ITEM = ["CANCELLED", "RETURNED"] as const;

export function parseRange(v: unknown): RevenueRange {
  const n = Number(v);
  return (REVENUE_RANGES as readonly number[]).includes(n) ? (n as RevenueRange) : 30;
}

export async function getRevenueReport(days: RevenueRange = 30, now = new Date()): Promise<RevenueReport> {
  const end = todayKey(now);
  const start = addDaysKey(end, -(days - 1));
  const prevStart = addDaysKey(start, -days);

  const [slots, stats, orders, prevOrders, sellerItems, prevSellerItems, commissionRows, sellers] = await Promise.all([
    db.adSlot.findMany({ orderBy: { sortOrder: "asc" } }),
    db.adStatDaily.findMany({
      where: { date: { gte: keyToDateCol(prevStart), lte: keyToDateCol(end) } },
      select: {
        date: true,
        impressions: true,
        clicks: true,
        spend: true,
        campaign: {
          select: {
            id: true,
            code: true,
            name: true,
            headline: true,
            status: true,
            isHouse: true,
            pricingModel: true,
            slotId: true,
            advertiserId: true,
            advertiser: { select: { companyName: true } },
            brand: { select: { name: true } },
          },
        },
      },
    }),
    db.order.findMany({
      where: { placedAt: { gte: keyToIstStart(start) }, status: { notIn: [...EXCLUDED_ORDER] } },
      select: { placedAt: true, subtotal: true, discount: true },
    }),
    db.order.aggregate({
      where: { placedAt: { gte: keyToIstStart(prevStart), lt: keyToIstStart(start) }, status: { notIn: [...EXCLUDED_ORDER] } },
      _sum: { subtotal: true, discount: true },
      _count: true,
    }),
    db.orderItem.groupBy({
      by: ["sellerId"],
      where: {
        sellerId: { not: null },
        status: { notIn: [...EXCLUDED_ITEM] },
        order: { placedAt: { gte: keyToIstStart(start) }, status: { notIn: ["PENDING_PAYMENT"] } },
      },
      _sum: { lineTotal: true, commissionAmt: true, qty: true },
    }),
    db.orderItem.aggregate({
      where: {
        sellerId: { not: null },
        status: { notIn: [...EXCLUDED_ITEM] },
        order: { placedAt: { gte: keyToIstStart(prevStart), lt: keyToIstStart(start) }, status: { notIn: ["PENDING_PAYMENT"] } },
      },
      _sum: { lineTotal: true },
    }),
    db.sellerLedgerEntry.groupBy({
      by: ["sellerId"],
      where: { type: "COMMISSION_DEBIT", createdAt: { gte: keyToIstStart(start) } },
      _sum: { amount: true },
    }),
    db.seller.findMany({ select: { id: true, displayName: true, status: true, commissionPct: true } }),
  ]);

  // ── daily series ──
  const keys = dayKeys(start, end);
  const daily = new Map<string, DailyPoint>(keys.map((k) => [k, { date: k, ad: 0, sales: 0, impressions: 0, clicks: 0, orders: 0 }]));
  for (const o of orders) {
    if (!o.placedAt) continue;
    const p = daily.get(istDayKey(o.placedAt));
    if (!p) continue;
    p.sales += o.subtotal - o.discount;
    p.orders += 1;
  }

  // ── ad aggregation ──
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const slotAgg = new Map<string, { revenue: number; impressions: number; clicks: number; paid: Set<string>; perDay: Map<string, Set<string>> }>();
  const advAgg = new Map<string, AdvertiserRevenue & { set: Set<string> }>();
  const modelAgg = new Map<PricingModel, ModelRevenue & { set: Set<string> }>();
  const campAgg = new Map<string, CampaignRevenue>();
  let prevAd = 0;
  let prevImpr = 0;
  let prevClicks = 0;
  let houseImpressions = 0;
  let lastStatDate: string | null = null;

  for (const s of stats) {
    const key = dateColKey(s.date);
    const c = s.campaign;
    if (key < start) {
      prevAd += s.spend;
      prevImpr += s.impressions;
      prevClicks += s.clicks;
      continue;
    }
    if (s.impressions > 0 && (!lastStatDate || key > lastStatDate)) lastStatDate = key;
    const p = daily.get(key);
    if (p) {
      p.ad += s.spend;
      p.impressions += s.impressions;
      p.clicks += s.clicks;
    }
    if (c.isHouse) houseImpressions += s.impressions;

    let sa = slotAgg.get(c.slotId);
    if (!sa) slotAgg.set(c.slotId, (sa = { revenue: 0, impressions: 0, clicks: 0, paid: new Set(), perDay: new Map() }));
    sa.revenue += s.spend;
    sa.impressions += s.impressions;
    sa.clicks += s.clicks;
    if (!c.isHouse && s.impressions > 0) {
      sa.paid.add(c.id);
      let day = sa.perDay.get(key);
      if (!day) sa.perDay.set(key, (day = new Set()));
      day.add(c.id);
    }

    if (!c.isHouse) {
      const advKey = c.advertiserId ?? `brand:${c.brand?.name ?? "Direct"}`;
      let a = advAgg.get(advKey);
      if (!a) {
        advAgg.set(
          advKey,
          (a = {
            id: c.advertiserId,
            name: c.advertiser?.companyName ?? c.brand?.name ?? "Direct bookings",
            brandName: c.brand?.name ?? null,
            revenue: 0,
            impressions: 0,
            clicks: 0,
            campaigns: 0,
            set: new Set(),
          }),
        );
      }
      a.revenue += s.spend;
      a.impressions += s.impressions;
      a.clicks += s.clicks;
      a.set.add(c.id);

      let m = modelAgg.get(c.pricingModel);
      if (!m) modelAgg.set(c.pricingModel, (m = { model: c.pricingModel, revenue: 0, impressions: 0, clicks: 0, campaigns: 0, set: new Set() }));
      m.revenue += s.spend;
      m.impressions += s.impressions;
      m.clicks += s.clicks;
      m.set.add(c.id);
    }

    let ca = campAgg.get(c.id);
    if (!ca) {
      const slot = slotById.get(c.slotId);
      campAgg.set(
        c.id,
        (ca = {
          id: c.id,
          code: c.code,
          name: c.name,
          headline: c.headline,
          slotCode: slot?.code ?? "—",
          slotName: slot?.name ?? "",
          advertiser: c.advertiser?.companyName ?? null,
          brandName: c.brand?.name ?? null,
          isHouse: c.isHouse,
          status: c.status,
          pricingModel: c.pricingModel,
          revenue: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          ecpm: 0,
        }),
      );
    }
    ca.revenue += s.spend;
    ca.impressions += s.impressions;
    ca.clicks += s.clicks;
  }

  // days that have delivery data (today usually has none until the stats job runs)
  const statDays = lastStatDate ? keys.filter((k) => k <= lastStatDate!) : [];

  const bySlot: SlotRevenue[] = slots.map((slot) => {
    const a = slotAgg.get(slot.id);
    let fillSum = 0;
    for (const k of statDays) fillSum += Math.min(slot.positions, a?.perDay.get(k)?.size ?? 0) / Math.max(1, slot.positions);
    return {
      code: slot.code,
      name: slot.name,
      page: slot.page,
      pricingModel: slot.pricingModel,
      isActive: slot.isActive,
      positions: slot.positions,
      potentialMonthly: slot.potentialMonthly,
      revenue: Math.round(a?.revenue ?? 0),
      impressions: a?.impressions ?? 0,
      clicks: a?.clicks ?? 0,
      ctr: ratio(a?.clicks ?? 0, a?.impressions ?? 0),
      ecpm: ratio(a?.revenue ?? 0, a?.impressions ?? 0) * 1000,
      campaigns: a?.paid.size ?? 0,
      fill: statDays.length ? fillSum / statDays.length : 0,
    };
  });

  const byAdvertiser = [...advAgg.values()]
    .map(({ set, ...a }) => ({ ...a, revenue: Math.round(a.revenue), campaigns: set.size }))
    .sort((x, y) => y.revenue - x.revenue);
  const byModel = [...modelAgg.values()]
    .map(({ set, ...m }) => ({ ...m, revenue: Math.round(m.revenue), campaigns: set.size }))
    .sort((x, y) => y.revenue - x.revenue);
  const topCampaigns = [...campAgg.values()]
    .map((c) => ({
      ...c,
      revenue: Math.round(c.revenue),
      ctr: ratio(c.clicks, c.impressions),
      ecpm: ratio(c.revenue, c.impressions) * 1000,
    }))
    .sort((x, y) => y.revenue - x.revenue || y.impressions - x.impressions);

  // ── sellers ──
  const itemsBySeller = new Map(sellerItems.map((r) => [r.sellerId!, r._sum]));
  const earnedBySeller = new Map(commissionRows.map((r) => [r.sellerId, -(r._sum.amount ?? 0)]));
  const sellerRows: SellerRevenue[] = sellers
    .map((s) => {
      const it = itemsBySeller.get(s.id);
      return {
        id: s.id,
        name: s.displayName,
        status: s.status,
        commissionPct: s.commissionPct,
        gmv: it?.lineTotal ?? 0,
        items: it?.qty ?? 0,
        commissionAccrued: it?.commissionAmt ?? 0,
        commissionEarned: earnedBySeller.get(s.id) ?? 0,
      };
    })
    .filter((s) => s.status === "APPROVED" || s.gmv > 0 || s.commissionEarned > 0)
    .sort((a, b) => b.gmv - a.gmv);

  // ── totals ──
  const series = [...daily.values()].map((p) => ({ ...p, ad: Math.round(p.ad) }));
  const ad = series.reduce((t, p) => t + p.ad, 0);
  const sales = series.reduce((t, p) => t + p.sales, 0);
  const orderCount = series.reduce((t, p) => t + p.orders, 0);
  const impressions = series.reduce((t, p) => t + p.impressions, 0);
  const clicks = series.reduce((t, p) => t + p.clicks, 0);
  const paidImpr = impressions - houseImpressions;
  const sellerGmv = sellerRows.reduce((t, s) => t + s.gmv, 0);
  const potentialMonthly = slots.reduce((t, s) => t + s.potentialMonthly, 0);
  const weightedFill = potentialMonthly ? bySlot.reduce((t, s) => t + s.fill * s.potentialMonthly, 0) / potentialMonthly : 0;

  const prevSales = (prevOrders._sum.subtotal ?? 0) - (prevOrders._sum.discount ?? 0);

  return {
    days,
    start,
    end,
    lastStatDate,
    daily: series,
    totals: {
      ad,
      sales,
      total: ad + sales,
      adShare: ratio(ad, ad + sales),
      orders: orderCount,
      aov: Math.round(ratio(sales, orderCount)),
      impressions,
      clicks,
      ctr: ratio(clicks, impressions),
      ecpm: ratio(ad, paidImpr) * 1000,
      houseImpressions,
      sellerGmv,
      commissionAccrued: sellerRows.reduce((t, s) => t + s.commissionAccrued, 0),
      commissionEarned: sellerRows.reduce((t, s) => t + s.commissionEarned, 0),
    },
    previous: {
      ad: Math.round(prevAd),
      sales: prevSales,
      total: Math.round(prevAd) + prevSales,
      impressions: prevImpr,
      clicks: prevClicks,
      orders: prevOrders._count,
      sellerGmv: prevSellerItems._sum.lineTotal ?? 0,
    },
    bySlot,
    byAdvertiser,
    byModel,
    topCampaigns,
    sellers: sellerRows,
    potentialMonthly,
    weightedFill,
  };
}

// ───────────────────────────── CSV export ─────────────────────────────

export const REVENUE_EXPORTS = ["daily", "slots", "advertisers", "campaigns", "sellers"] as const;
export type RevenueExport = (typeof REVENUE_EXPORTS)[number];

export function revenueCsv(r: RevenueReport, kind: RevenueExport): { filename: string; csv: string } {
  const tag = `${r.start}_to_${r.end}`;
  const pct = (x: number) => (x * 100).toFixed(2);
  switch (kind) {
    case "daily":
      return {
        filename: `tbb-revenue-daily_${tag}.csv`,
        csv: toCsv(
          ["Date", "Ad revenue (INR)", "Product sales (INR)", "Total (INR)", "Orders", "Impressions", "Clicks", "CTR %"],
          r.daily.map((d) => [d.date, d.ad, d.sales, d.ad + d.sales, d.orders, d.impressions, d.clicks, pct(ratio(d.clicks, d.impressions))]),
        ),
      };
    case "slots":
      return {
        filename: `tbb-revenue-by-slot_${tag}.csv`,
        csv: toCsv(
          ["Slot", "Name", "Page", "Pricing", "Status", "Revenue (INR)", "Impressions", "Clicks", "CTR %", "eCPM (INR)", "Paid campaigns", "Fill %", "Potential / month (INR)"],
          r.bySlot.map((s) => [
            s.code,
            s.name,
            s.page,
            s.pricingModel,
            s.isActive ? "Live" : "Paused",
            s.revenue,
            s.impressions,
            s.clicks,
            pct(s.ctr),
            s.ecpm.toFixed(2),
            s.campaigns,
            pct(s.fill),
            s.potentialMonthly,
          ]),
        ),
      };
    case "advertisers":
      return {
        filename: `tbb-revenue-by-advertiser_${tag}.csv`,
        csv: toCsv(
          ["Advertiser", "Brand", "Revenue (INR)", "Impressions", "Clicks", "CTR %", "Campaigns"],
          r.byAdvertiser.map((a) => [a.name, a.brandName, a.revenue, a.impressions, a.clicks, pct(ratio(a.clicks, a.impressions)), a.campaigns]),
        ),
      };
    case "campaigns":
      return {
        filename: `tbb-revenue-by-campaign_${tag}.csv`,
        csv: toCsv(
          ["Campaign", "Name", "Slot", "Advertiser", "House", "Status", "Pricing", "Revenue (INR)", "Impressions", "Clicks", "CTR %", "eCPM (INR)"],
          r.topCampaigns.map((c) => [
            c.code,
            c.name,
            c.slotCode,
            c.advertiser ?? c.brandName,
            c.isHouse ? "yes" : "no",
            c.status,
            c.pricingModel,
            c.revenue,
            c.impressions,
            c.clicks,
            pct(c.ctr),
            c.ecpm.toFixed(2),
          ]),
        ),
      };
    case "sellers":
      return {
        filename: `tbb-seller-gmv_${tag}.csv`,
        csv: toCsv(
          ["Seller", "Status", "Commission %", "GMV (INR)", "Units", "Commission accrued (INR)", "Commission earned (INR)"],
          r.sellers.map((s) => [s.name, s.status, s.commissionPct, s.gmv, s.items, s.commissionAccrued, s.commissionEarned]),
        ),
      };
  }
}
