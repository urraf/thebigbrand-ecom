import "server-only";
import { db, type OrderStatus } from "@/lib/db";
import { getPendingCounts, type PendingCounts } from "./counts";
import { addDays, istDateOnly, istDayStart, istKey, istMonthStart, istPrevMonthStart } from "./time";

/** Orders that count as revenue (paid / COD placed, not cancelled or returned). */
export const REVENUE_STATUSES: OrderStatus[] = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED"];
const REV_SQL = `'PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','RETURN_REQUESTED'`;

export type RevenueDay = { date: string; sales: number; orders: number; ad: number };

export type DashboardData = {
  now: string;
  kpis: {
    salesToday: number;
    ordersToday: number;
    ordersYesterday: number;
    salesMtd: number;
    ordersMtd: number;
    aovMtd: number;
    salesPrevPeriod: number; // same days of last month
    adMtd: number;
    adToday: number;
    adPrevPeriod: number;
    liveCampaigns: number;
    giftConversion: { gifted: number; converted: number; rate: number };
  };
  pending: PendingCounts;
  revenue: RevenueDay[]; // last 30 IST days, oldest first
  recentOrders: Array<{
    number: string;
    status: OrderStatus;
    total: number;
    placedAt: string;
    customer: string;
    city: string;
    items: number;
    paymentMethod: string;
    gifts: Array<{ name: string; c1: string | null }>;
  }>;
  lowStock: Array<{ id: string; name: string; brand: string; stock: number; sold: number }>;
  outOfStock: number;
  topProducts: Array<{ id: string; name: string; brand: string; units: number; revenue: number }>;
  attention: Array<{ key: string; tone: "coral" | "violet" | "crit" | "gold" | "ok"; icon: string; title: string; sub: string; href: string; cta: string }>;
};

async function salesBetween(from: Date, to: Date) {
  const r = await db.order.aggregate({
    where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: from, lt: to } },
    _sum: { total: true },
    _count: { _all: true },
  });
  return { total: r._sum.total ?? 0, count: r._count._all };
}

async function adBetween(from: Date, to: Date) {
  const r = await db.adStatDaily.aggregate({ where: { date: { gte: from, lt: to } }, _sum: { spend: true } });
  return Math.round(r._sum.spend ?? 0);
}

/** Share of customers who received a TBB Original mini and later bought that full-size product. */
export async function giftConversion(): Promise<{ gifted: number; converted: number; rate: number }> {
  const rows = await db.$queryRawUnsafe<Array<{ gifted: number; converted: number }>>(`
    WITH gifted AS (
      SELECT o."userId", gi."productId", MIN(COALESCE(o."placedAt", o."createdAt")) AS first_at
      FROM "OrderGift" og
      JOIN "Order" o ON o.id = og."orderId"
      JOIN "GiftItem" gi ON gi.id = og."giftItemId"
      WHERE o.status::text IN (${REV_SQL})
      GROUP BY 1, 2
    ), converted AS (
      SELECT DISTINCT g."userId"
      FROM gifted g
      JOIN "Order" o2 ON o2."userId" = g."userId" AND COALESCE(o2."placedAt", o2."createdAt") > g.first_at AND o2.status::text IN (${REV_SQL})
      JOIN "OrderItem" oi ON oi."orderId" = o2.id AND oi."productId" = g."productId" AND oi.status::text <> 'CANCELLED'
    )
    SELECT (SELECT COUNT(DISTINCT "userId") FROM gifted)::int AS gifted, (SELECT COUNT(*) FROM converted)::int AS converted
  `);
  const gifted = Number(rows[0]?.gifted ?? 0);
  const converted = Number(rows[0]?.converted ?? 0);
  return { gifted, converted, rate: gifted ? converted / gifted : 0 };
}

export async function revenueSeries(days = 30, now = new Date()): Promise<RevenueDay[]> {
  const start = addDays(istDayStart(now), -(days - 1));
  const startDate = istDateOnly(start);
  const [sales, ads] = await Promise.all([
    db.$queryRawUnsafe<Array<{ d: string; total: number; n: number }>>(
      `SELECT to_char((("placedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS d,
              SUM(total)::int AS total, COUNT(*)::int AS n
       FROM "Order" WHERE "placedAt" >= $1 AND status::text IN (${REV_SQL})
       GROUP BY 1`,
      start,
    ),
    db.$queryRawUnsafe<Array<{ d: string; spend: number }>>(
      `SELECT to_char(date, 'YYYY-MM-DD') AS d, SUM(spend)::float8 AS spend FROM "AdStatDaily" WHERE date >= $1 GROUP BY 1`,
      startDate,
    ),
  ]);
  const s = new Map(sales.map((r) => [r.d, r]));
  const a = new Map(ads.map((r) => [r.d, Number(r.spend)]));
  return Array.from({ length: days }, (_, i) => {
    const key = istKey(addDays(start, i));
    const row = s.get(key);
    return { date: key, sales: Number(row?.total ?? 0), orders: Number(row?.n ?? 0), ad: Math.round(a.get(key) ?? 0) };
  });
}

export async function getDashboard(now = new Date()): Promise<DashboardData> {
  const today = istDayStart(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const monthStart = istMonthStart(now);
  const prevMonthStart = istPrevMonthStart(now);
  // same elapsed span of last month (e.g. 1–25 Oct vs 1–25 Nov)
  const elapsed = now.getTime() - monthStart.getTime();
  const prevPeriodEnd = new Date(Math.min(prevMonthStart.getTime() + elapsed, monthStart.getTime()));
  const monthStartDate = istDateOnly(monthStart);
  const prevMonthStartDate = istDateOnly(prevMonthStart);
  const prevPeriodEndDate = istDateOnly(prevPeriodEnd);
  const todayDate = istDateOnly(now);
  const thirty = addDays(today, -29);

  const [
    sToday,
    sYesterday,
    sMtd,
    sPrev,
    adMtd,
    adToday,
    adPrev,
    liveCampaigns,
    conv,
    pending,
    revenue,
    recent,
    lowStock,
    outOfStock,
    top,
    lowGifts,
    staleOrders,
  ] = await Promise.all([
    salesBetween(today, tomorrow),
    salesBetween(yesterday, today),
    salesBetween(monthStart, tomorrow),
    salesBetween(prevMonthStart, prevPeriodEnd),
    adBetween(monthStartDate, addDays(todayDate, 1)),
    adBetween(todayDate, addDays(todayDate, 1)),
    adBetween(prevMonthStartDate, addDays(prevPeriodEndDate, 1)),
    db.adCampaign.count({ where: { status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now }, slot: { isActive: true } } }),
    giftConversion(),
    getPendingCounts(),
    revenueSeries(30, now),
    db.order.findMany({
      where: { status: { not: "PENDING_PAYMENT" } },
      orderBy: { placedAt: "desc" },
      take: 7,
      select: {
        number: true,
        status: true,
        total: true,
        placedAt: true,
        createdAt: true,
        shipName: true,
        shipCity: true,
        paymentMethod: true,
        user: { select: { name: true } },
        items: { select: { qty: true } },
        gifts: { select: { name: true, giftItem: { select: { product: { select: { colorPrimary: true } } } } } },
      },
    }),
    db.product.findMany({
      where: { status: "ACTIVE", stock: { gt: 0, lte: 10 } },
      orderBy: [{ stock: "asc" }, { soldCount: "desc" }],
      take: 6,
      select: { id: true, name: true, stock: true, soldCount: true, brand: { select: { name: true } } },
    }),
    db.product.count({ where: { status: "ACTIVE", stock: { lte: 0 } } }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { status: { not: "CANCELLED" }, order: { status: { in: REVENUE_STATUSES }, placedAt: { gte: thirty } } },
      _sum: { qty: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 6,
    }),
    db.giftItem.findMany({ where: { isActive: true, stock: { lt: 50 } }, select: { id: true, miniName: true, stock: true } }),
    db.order.count({ where: { status: "PLACED", placedAt: { lt: addDays(now, -1) } } }),
  ]);

  const topMeta = top.length
    ? await db.product.findMany({ where: { id: { in: top.map((t) => t.productId) } }, select: { id: true, name: true, brand: { select: { name: true } } } })
    : [];
  const metaById = new Map(topMeta.map((p) => [p.id, p]));

  const attention: DashboardData["attention"] = [];
  if (pending.approvals)
    attention.push({ key: "approvals", tone: "coral", icon: "check", title: `${pending.approvals} seller product${pending.approvals > 1 ? "s" : ""} to approve`, sub: "They go live on the store once you approve", href: "/admin/approvals", cta: "Review" });
  if (pending.newOrders)
    attention.push({
      key: "orders",
      tone: staleOrders ? "crit" : "violet",
      icon: "box",
      title: `${pending.newOrders} new order${pending.newOrders > 1 ? "s" : ""} to confirm`,
      sub: staleOrders ? `${staleOrders} waiting more than 24 hours` : "Confirm and pack today to ship by tomorrow",
      href: "/admin/orders?status=PLACED",
      cta: "Open",
    });
  if (pending.campaigns)
    attention.push({ key: "campaigns", tone: "coral", icon: "layers", title: `${pending.campaigns} ad campaign${pending.campaigns > 1 ? "s" : ""} awaiting approval`, sub: "Brands are waiting to go live", href: "/admin/campaigns", cta: "Review" });
  if (pending.sellers)
    attention.push({ key: "sellers", tone: "gold", icon: "store", title: `${pending.sellers} seller application${pending.sellers > 1 ? "s" : ""}`, sub: "KYC and bank details to verify", href: "/admin/sellers", cta: "Review" });
  for (const g of lowGifts)
    attention.push({ key: `gift-${g.id}`, tone: "crit", icon: "gift", title: `${g.miniName} mini is running low`, sub: `${g.stock} left — restock before it disappears from checkout`, href: "/admin/gifts", cta: "Restock" });
  if (outOfStock)
    attention.push({ key: "oos", tone: "crit", icon: "bag", title: `${outOfStock} product${outOfStock > 1 ? "s are" : " is"} out of stock`, sub: "Shoppers can't add them to cart", href: "/admin/products?stock=out", cta: "View" });

  return {
    now: now.toISOString(),
    kpis: {
      salesToday: sToday.total,
      ordersToday: sToday.count,
      ordersYesterday: sYesterday.count,
      salesMtd: sMtd.total,
      ordersMtd: sMtd.count,
      aovMtd: sMtd.count ? Math.round(sMtd.total / sMtd.count) : 0,
      salesPrevPeriod: sPrev.total,
      adMtd,
      adToday,
      adPrevPeriod: adPrev,
      liveCampaigns,
      giftConversion: conv,
    },
    pending,
    revenue,
    recentOrders: recent.map((o) => ({
      number: o.number,
      status: o.status,
      total: o.total,
      placedAt: (o.placedAt ?? o.createdAt).toISOString(),
      customer: o.user.name || o.shipName,
      city: o.shipCity,
      items: o.items.reduce((t, i) => t + i.qty, 0),
      paymentMethod: o.paymentMethod,
      gifts: o.gifts.map((g) => ({ name: g.name, c1: g.giftItem.product.colorPrimary })),
    })),
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, brand: p.brand.name, stock: p.stock, sold: p.soldCount })),
    outOfStock,
    topProducts: top
      .map((t) => {
        const m = metaById.get(t.productId);
        return m ? { id: m.id, name: m.name, brand: m.brand.name, units: t._sum.qty ?? 0, revenue: t._sum.lineTotal ?? 0 } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x),
    attention,
  };
}
