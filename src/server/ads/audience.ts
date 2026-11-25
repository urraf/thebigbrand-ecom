import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { istDateKey } from "./dates";

/** Live audience & delivery figures for the Advertise page hero (all computed from the database). */
export type AudienceStats = {
  /** ad impressions delivered in the last 30 days */
  impressions30d: number;
  clicks30d: number;
  ctr30d: number;
  /** placed orders in the last 30 days (excl. unpaid / cancelled) */
  orders30d: number;
  /** distinct shoppers who ordered in the last 90 days */
  shoppers90d: number;
  /** average order value over the last 90 days (₹) */
  aov: number;
  /** distinct delivery cities */
  cities: number;
  brands: number;
  products: number;
  liveCampaigns: number;
  /** last 14 complete days of impressions (oldest → newest) for the sparkline */
  daily: number[];
  /** today so far */
  impressionsToday: number;
  clicksToday: number;
  /** the last complete day (yesterday, IST) */
  impressionsYesterday: number;
  clicksYesterday: number;
};

export async function getAudienceStats(): Promise<AudienceStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.ads, TAGS.products, TAGS.brands);

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const d90 = new Date(now.getTime() - 90 * 864e5);
  const d14 = new Date(now.getTime() - 14 * 864e5);
  const placed = { notIn: ["PENDING_PAYMENT", "CANCELLED"] as ("PENDING_PAYMENT" | "CANCELLED")[] };

  const [imp30, orders30, aov, shoppers, cities, brands, products, live, daily] = await Promise.all([
    db.adStatDaily.aggregate({ where: { date: { gte: d30 } }, _sum: { impressions: true, clicks: true } }),
    db.order.count({ where: { createdAt: { gte: d30 }, status: placed } }),
    db.order.aggregate({ where: { createdAt: { gte: d90 }, status: placed }, _avg: { total: true } }),
    db.order.groupBy({ by: ["userId"], where: { createdAt: { gte: d90 }, status: placed } }),
    db.order.groupBy({ by: ["shipCity"], where: { status: placed } }),
    db.brand.count({ where: { isOwn: false } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.adCampaign.count({ where: { status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now } } }),
    db.adStatDaily.groupBy({ by: ["date"], where: { date: { gte: d14 } }, _sum: { impressions: true, clicks: true }, orderBy: { date: "asc" } }),
  ]);
  const imps = imp30._sum.impressions ?? 0;
  const clicks = imp30._sum.clicks ?? 0;
  const todayKey = istDateKey(now);
  const key = (d: { date: Date }) => d.date.toISOString().slice(0, 10);
  const last = daily.find((d) => key(d) === todayKey);
  const yKey = new Date(Date.parse(`${todayKey}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const yest = daily.find((d) => key(d) === yKey);
  const complete = daily.filter((d) => key(d) !== todayKey);
  return {
    impressions30d: imps,
    clicks30d: clicks,
    ctr30d: imps ? clicks / imps : 0,
    orders30d: orders30,
    shoppers90d: shoppers.length,
    aov: Math.round(aov._avg.total ?? 0),
    cities: cities.length,
    brands,
    products,
    liveCampaigns: live,
    daily: complete.map((d) => d._sum.impressions ?? 0),
    impressionsToday: last?._sum.impressions ?? 0,
    clicksToday: last?._sum.clicks ?? 0,
    impressionsYesterday: yest?._sum.impressions ?? 0,
    clicksYesterday: yest?._sum.clicks ?? 0,
  };
}
