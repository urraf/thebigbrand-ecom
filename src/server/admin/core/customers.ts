import "server-only";
import { z } from "zod";
import { db, Prisma } from "@/lib/db";
import { err, paged } from "@/lib/api";
import { audit } from "@/lib/audit";
import { REVENUE_STATUSES } from "./dashboard";

export const CustomerListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  segment: z.enum(["buyers", "repeat", "none"]).optional(),
  sort: z.enum(["recent", "orders", "spent", "name", "last"]).default("recent"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuery>;

const REV = Prisma.join(REVENUE_STATUSES.map((s) => Prisma.sql`${s}`));

export async function listCustomers(q: CustomerListQuery) {
  const conds: Prisma.Sql[] = [Prisma.sql`u.role = 'CUSTOMER'`];
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    const digits = q.q.replace(/\D/g, "");
    conds.push(
      digits.length >= 4
        ? Prisma.sql`(u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone LIKE ${"%" + digits + "%"})`
        : Prisma.sql`(u.name ILIKE ${like} OR u.email ILIKE ${like})`,
    );
  }
  if (q.status === "active") conds.push(Prisma.sql`u."isActive" = true`);
  if (q.status === "disabled") conds.push(Prisma.sql`u."isActive" = false`);
  const where = Prisma.join(conds, " AND ");
  const having =
    q.segment === "buyers" ? Prisma.sql`HAVING COUNT(o.id) > 0` : q.segment === "repeat" ? Prisma.sql`HAVING COUNT(o.id) > 1` : q.segment === "none" ? Prisma.sql`HAVING COUNT(o.id) = 0` : Prisma.empty;
  const dir = q.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const order =
    q.sort === "orders"
      ? Prisma.sql`orders ${dir}, u."createdAt" DESC`
      : q.sort === "spent"
        ? Prisma.sql`spent ${dir}, u."createdAt" DESC`
        : q.sort === "name"
          ? Prisma.sql`u.name ${dir} NULLS LAST`
          : q.sort === "last"
            ? Prisma.sql`last_order ${dir} NULLS LAST`
            : Prisma.sql`u."createdAt" ${dir}`;

  const base = Prisma.sql`
    FROM "User" u
    LEFT JOIN "Order" o ON o."userId" = u.id AND o.status::text IN (${REV})
    WHERE ${where}
    GROUP BY u.id ${having}`;

  const [rows, totalRow] = await Promise.all([
    db.$queryRaw<
      Array<{ id: string; name: string | null; email: string | null; phone: string | null; isActive: boolean; createdAt: Date; lastLoginAt: Date | null; orders: number; spent: number; last_order: Date | null }>
    >(Prisma.sql`SELECT u.id, u.name, u.email, u.phone, u."isActive", u."createdAt", u."lastLoginAt",
        COUNT(o.id)::int AS orders, COALESCE(SUM(o.total), 0)::int AS spent, MAX(o."createdAt") AS last_order
      ${base}
      ORDER BY ${order}
      LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`),
    db.$queryRaw<Array<{ n: number }>>(Prisma.sql`SELECT COUNT(*)::int AS n FROM (SELECT u.id ${base}) t`),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    orders: Number(r.orders),
    spent: Number(r.spent),
    lastOrderAt: r.last_order ? new Date(r.last_order).toISOString() : null,
  }));
  return paged(items, Number(totalRow[0]?.n ?? 0), q.page, q.limit);
}

export async function customerStats() {
  const [total, disabled, buyers, repeat, newMonth] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", isActive: false } }),
    db.user.count({ where: { role: "CUSTOMER", orders: { some: { status: { in: REVENUE_STATUSES } } } } }),
    db.$queryRaw<Array<{ n: number }>>(Prisma.sql`SELECT COUNT(*)::int AS n FROM (SELECT o."userId" FROM "Order" o WHERE o.status::text IN (${REV}) GROUP BY o."userId" HAVING COUNT(*) > 1) t`),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
  ]);
  return { total, disabled, buyers, repeat: Number(repeat[0]?.n ?? 0), newMonth };
}

export async function getCustomer(id: string) {
  const u = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
      addresses: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          number: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
          items: { select: { qty: true } },
          gifts: { select: { name: true, giftItem: { select: { product: { select: { colorPrimary: true } } } } } },
        },
      },
      _count: { select: { orders: true, reviews: true, wishlist: true, couponUses: true, sessions: true } },
    },
  });
  if (!u || (u.role !== "CUSTOMER" && u.role !== "SELLER")) return null;
  const agg = await db.order.aggregate({ where: { userId: id, status: { in: REVENUE_STATUSES } }, _sum: { total: true }, _count: { _all: true }, _min: { createdAt: true }, _max: { createdAt: true } });
  const activeSessions = await db.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } });
  const giftsReceived = await db.orderGift.count({ where: { order: { userId: id, status: { in: REVENUE_STATUSES } } } });
  const spent = agg._sum.total ?? 0;
  const paidOrders = agg._count._all;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    addresses: u.addresses.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() })),
    orders: u.orders.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      itemCount: o.items.reduce((t, i) => t + i.qty, 0),
      gifts: o.gifts.map((g) => ({ name: g.name, c1: g.giftItem.product.colorPrimary })),
    })),
    stats: {
      orders: u._count.orders,
      paidOrders,
      spent,
      aov: paidOrders ? Math.round(spent / paidOrders) : 0,
      firstOrderAt: agg._min.createdAt?.toISOString() ?? null,
      lastOrderAt: agg._max.createdAt?.toISOString() ?? null,
      reviews: u._count.reviews,
      wishlist: u._count.wishlist,
      couponUses: u._count.couponUses,
      giftsReceived,
      activeSessions,
    },
  };
}
export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

export const CustomerPatch = z.object({ isActive: z.boolean(), reason: z.string().trim().max(300).optional() });

/** Disable / re-enable a customer account. Disabling signs them out everywhere. */
export async function setCustomerActive(id: string, body: z.infer<typeof CustomerPatch>, actorId: string) {
  const u = await db.user.findUnique({ where: { id }, select: { id: true, role: true, name: true, email: true, isActive: true } });
  if (!u) throw err.notFound("Customer not found");
  if (u.role === "ADMIN" || u.role === "STAFF") throw err.forbidden("Team accounts are managed separately");
  if (u.isActive === body.isActive) return { id, isActive: u.isActive };
  await db.$transaction([
    db.user.update({ where: { id }, data: { isActive: body.isActive } }),
    ...(body.isActive ? [] : [db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })]),
  ]);
  await audit(actorId, body.isActive ? "customer.enable" : "customer.disable", "User", id, { name: u.name ?? u.email, reason: body.reason ?? null });
  return { id, isActive: body.isActive };
}
