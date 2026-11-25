import "server-only";
import { db, type Prisma } from "@/lib/db";
import { istDateKey } from "@/components/seller/format";
import { getSellerBalance } from "./ledger";
import { listSellerOrders } from "./orders";

/** Everything the seller dashboard shows, in one call (also GET /api/v1/seller/dashboard for the app). */

const DAY = 86_400_000;
const IST = 5.5 * 3600_000;

/** Start of the IST calendar day containing `d`, as a UTC Date. */
function istStartOfDay(d: Date) {
  return new Date(Math.floor((d.getTime() + IST) / DAY) * DAY - IST);
}

const liveItem = (sellerId: string, since?: Date, until?: Date): Prisma.OrderItemWhereInput => ({
  sellerId,
  status: { notIn: ["CANCELLED"] },
  order: { status: { not: "PENDING_PAYMENT" }, ...(since || until ? { createdAt: { ...(since ? { gte: since } : {}), ...(until ? { lt: until } : {}) } } : {}) },
});

export type DailyPoint = { date: string; sales: number; units: number; orders: number };

export async function getSellerDashboard(sellerId: string) {
  const now = new Date();
  const today = istStartOfDay(now);
  const start30 = new Date(today.getTime() - 29 * DAY);
  const start60 = new Date(today.getTime() - 59 * DAY);

  const [todayAgg, agg30, aggPrev, items30, toShip, products, lowStock, balance, recent, campaigns] = await Promise.all([
    db.orderItem.aggregate({ where: liveItem(sellerId, today), _sum: { lineTotal: true, qty: true }, _count: { _all: true } }),
    db.orderItem.aggregate({ where: liveItem(sellerId, start30), _sum: { lineTotal: true, qty: true, sellerEarning: true } }),
    db.orderItem.aggregate({ where: liveItem(sellerId, start60, start30), _sum: { lineTotal: true } }),
    db.orderItem.findMany({ where: liveItem(sellerId, start30), select: { lineTotal: true, qty: true, orderId: true, order: { select: { createdAt: true } } } }),
    db.orderItem.groupBy({
      by: ["status"],
      where: { sellerId, status: { in: ["PLACED", "CONFIRMED", "PACKED"] }, order: { status: { not: "PENDING_PAYMENT" } } },
      _count: { _all: true },
    }),
    db.product.groupBy({ by: ["status"], where: { sellerId }, _count: { _all: true } }),
    db.product.findMany({
      where: { sellerId, status: "ACTIVE", stock: { lte: 10 } },
      orderBy: { stock: "asc" },
      take: 5,
      select: { id: true, name: true, stock: true, price: true, brand: { select: { name: true } }, shape: true, colorPrimary: true, colorSecondary: true, images: { select: { url: true, alt: true }, take: 1, orderBy: { sortOrder: "asc" } } },
    }),
    getSellerBalance(sellerId),
    listSellerOrders(sellerId, { tab: "all", limit: 6 }),
    db.adCampaign.groupBy({ by: ["status"], where: { sellerId }, _count: { _all: true }, _sum: { spent: true, clicks: true, impressions: true } }),
  ]);

  // 30 daily buckets (IST)
  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < 30; i++) {
    const key = istDateKey(new Date(start30.getTime() + i * DAY + IST / 2 + 3600_000));
    buckets.set(key, { date: key, sales: 0, units: 0, orders: 0 });
  }
  const ordersPerDay = new Map<string, Set<string>>();
  for (const it of items30) {
    const key = istDateKey(it.order.createdAt);
    const b = buckets.get(key);
    if (!b) continue;
    b.sales += it.lineTotal;
    b.units += it.qty;
    if (!ordersPerDay.has(key)) ordersPerDay.set(key, new Set());
    ordersPerDay.get(key)!.add(it.orderId);
  }
  for (const [k, set] of ordersPerDay) buckets.get(k)!.orders = set.size;
  const series = [...buckets.values()];

  const ship = Object.fromEntries(toShip.map((s) => [s.status, s._count._all])) as Record<string, number>;
  const prod = Object.fromEntries(products.map((s) => [s.status, s._count._all])) as Record<string, number>;
  const sales30 = agg30._sum.lineTotal ?? 0;
  const salesPrev = aggPrev._sum.lineTotal ?? 0;
  const camp = Object.fromEntries(campaigns.map((c) => [c.status, c])) as Record<string, (typeof campaigns)[number]>;

  return {
    today: { sales: todayAgg._sum.lineTotal ?? 0, units: todayAgg._sum.qty ?? 0, items: todayAgg._count._all },
    last30: {
      sales: sales30,
      units: agg30._sum.qty ?? 0,
      earning: agg30._sum.sellerEarning ?? 0,
      orders: new Set(items30.map((i) => i.orderId)).size,
      prevSales: salesPrev,
      deltaPct: salesPrev > 0 ? Math.round(((sales30 - salesPrev) / salesPrev) * 100) : null,
    },
    series,
    toShip: { total: (ship.PLACED ?? 0) + (ship.CONFIRMED ?? 0) + (ship.PACKED ?? 0), placed: ship.PLACED ?? 0, confirmed: ship.CONFIRMED ?? 0, packed: ship.PACKED ?? 0 },
    products: {
      live: prod.ACTIVE ?? 0,
      pending: prod.PENDING ?? 0,
      rejected: prod.REJECTED ?? 0,
      draft: prod.DRAFT ?? 0,
      total: Object.values(prod).reduce((a, b) => a + b, 0),
    },
    lowStock: lowStock.map((p) => ({
      id: p.id,
      name: p.name,
      brandName: p.brand.name,
      stock: p.stock,
      price: p.price,
      image: p.images[0] ?? null,
      art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary },
    })),
    balance,
    recentOrders: recent.items,
    ads: {
      live: camp.APPROVED?._count._all ?? 0,
      inReview: camp.PENDING_REVIEW?._count._all ?? 0,
      spent: Math.round(campaigns.reduce((s, c) => s + (c._sum.spent ?? 0), 0)),
      clicks: campaigns.reduce((s, c) => s + (c._sum.clicks ?? 0), 0),
    },
    generatedAt: now.toISOString(),
  };
}

export type SellerDashboard = Awaited<ReturnType<typeof getSellerDashboard>>;

/** Small counts for the sidebar badges. */
export async function getSellerNavCounts(sellerId: string) {
  const [toShip, pending] = await Promise.all([
    db.orderItem.count({ where: { sellerId, status: { in: ["PLACED", "CONFIRMED", "PACKED"] }, order: { status: { not: "PENDING_PAYMENT" } } } }),
    db.product.count({ where: { sellerId, status: { in: ["PENDING", "REJECTED"] } } }),
  ]);
  return { orders: toShip, products: pending };
}
