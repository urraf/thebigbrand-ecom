import "server-only";
import { z } from "zod";
import { db, Prisma, type SellerStatus } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { asJson, ratio } from "./util";

/**
 * SELLERS — marketplace vendor onboarding (KYC review) and account control.
 * approve → status APPROVED, approvedAt, user role SELLER (never downgrades staff) · reject (reason) ·
 * suspend → status SUSPENDED and their live products are taken off the store (restored on reactivate).
 * Commission % applies to orders placed after the change (order items snapshot the rate at checkout).
 */

export const SELLER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;

export const sellerListQuery = z.object({
  status: z.enum(SELLER_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const DAY = 86_400_000;

/** Σ ledger per seller (signed ₹; + owed to the seller). */
export async function ledgerBalances(sellerIds?: string[]): Promise<Map<string, number>> {
  const rows = await db.sellerLedgerEntry.groupBy({
    by: ["sellerId"],
    where: sellerIds ? { sellerId: { in: sellerIds } } : undefined,
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.sellerId, r._sum.amount ?? 0]));
}

export async function listSellers(query: z.infer<typeof sellerListQuery>, now = new Date()) {
  const where: Prisma.SellerWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { displayName: { contains: query.q, mode: "insensitive" } },
      { businessName: { contains: query.q, mode: "insensitive" } },
      { contactName: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
      { gstin: { contains: query.q, mode: "insensitive" } },
      { city: { contains: query.q, mode: "insensitive" } },
    ];
  }
  const [rows, total, counts] = await Promise.all([
    db.seller.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { user: { select: { lastLoginAt: true, isActive: true } } },
    }),
    db.seller.count({ where }),
    db.seller.groupBy({ by: ["status"], _count: true }),
  ]);
  const ids = rows.map((r) => r.id);
  const [products, gmv, balances, openPayouts] = await Promise.all([
    db.product.groupBy({ by: ["sellerId", "status"], where: { sellerId: { in: ids } }, _count: true }),
    db.orderItem.groupBy({
      by: ["sellerId"],
      where: {
        sellerId: { in: ids },
        status: { notIn: ["CANCELLED", "RETURNED"] },
        order: { placedAt: { gte: new Date(now.getTime() - 30 * DAY) }, status: { not: "PENDING_PAYMENT" } },
      },
      _sum: { lineTotal: true, qty: true },
    }),
    ledgerBalances(ids),
    db.payout.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } }),
  ]);
  const prodBy = (id: string, status?: string) =>
    products.filter((p) => p.sellerId === id && (!status || p.status === status)).reduce((t, p) => t + p._count, 0);
  const gmvBy = new Map(gmv.map((g) => [g.sellerId!, g._sum]));
  const openBy = new Map(openPayouts.map((p) => [p.sellerId, p._sum.amount ?? 0]));

  return {
    items: rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      businessName: s.businessName,
      contactName: s.contactName,
      email: s.email,
      phone: s.phone,
      city: s.city,
      state: s.state,
      gstin: s.gstin,
      pan: s.pan,
      addressLine: s.addressLine,
      pincode: s.pincode,
      bankAccountName: s.bankAccountName,
      bankAccountNumber: s.bankAccountNumber,
      bankIfsc: s.bankIfsc,
      upiId: s.upiId,
      categories: s.categories,
      brandsAuthorised: s.brandsAuthorised,
      description: s.description,
      status: s.status,
      rejectionReason: s.rejectionReason,
      commissionPct: s.commissionPct,
      createdAt: s.createdAt.toISOString(),
      approvedAt: s.approvedAt?.toISOString() ?? null,
      lastLoginAt: s.user.lastLoginAt?.toISOString() ?? null,
      products: prodBy(s.id),
      liveProducts: prodBy(s.id, "ACTIVE"),
      pendingProducts: prodBy(s.id, "PENDING"),
      gmv30: gmvBy.get(s.id)?.lineTotal ?? 0,
      units30: gmvBy.get(s.id)?.qty ?? 0,
      balance: balances.get(s.id) ?? 0,
      openPayouts: openBy.get(s.id) ?? 0,
    })),
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    counts: Object.fromEntries(SELLER_STATUSES.map((st) => [st, counts.find((c) => c.status === st)?._count ?? 0])) as Record<SellerStatus, number>,
  };
}
export type SellerListItem = Awaited<ReturnType<typeof listSellers>>["items"][number];

export async function getSeller(id: string, now = new Date()) {
  const s = await db.seller.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, phone: true, name: true, role: true, lastLoginAt: true, isActive: true, createdAt: true } } },
  });
  if (!s) return null;
  const since30 = new Date(now.getTime() - 30 * DAY);
  const [products, items, ledger, payouts, balanceRow, campaigns] = await Promise.all([
    db.product.findMany({
      where: { sellerId: id },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: { id: true, slug: true, name: true, size: true, price: true, mrp: true, stock: true, status: true, soldCount: true, rejectionReason: true, brand: { select: { name: true } }, category: { select: { name: true } } },
    }),
    db.orderItem.findMany({
      where: { sellerId: id, order: { status: { not: "PENDING_PAYMENT" } } },
      orderBy: { order: { createdAt: "desc" } },
      take: 200,
      select: {
        id: true,
        name: true,
        brandName: true,
        qty: true,
        price: true,
        lineTotal: true,
        status: true,
        commissionPct: true,
        commissionAmt: true,
        sellerEarning: true,
        courier: true,
        trackingNumber: true,
        shippedAt: true,
        deliveredAt: true,
        order: { select: { id: true, number: true, placedAt: true, createdAt: true, shipCity: true, shipName: true, status: true } },
      },
    }),
    db.sellerLedgerEntry.findMany({
      where: { sellerId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, type: true, amount: true, note: true, createdAt: true, payoutId: true, orderItem: { select: { order: { select: { number: true } } } } },
    }),
    db.payout.findMany({ where: { sellerId: id }, orderBy: { createdAt: "desc" } }),
    db.sellerLedgerEntry.aggregate({ where: { sellerId: id }, _sum: { amount: true } }),
    db.adCampaign.findMany({
      where: { sellerId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, code: true, name: true, status: true, spent: true, startsAt: true, endsAt: true, slot: { select: { code: true, name: true } } },
    }),
  ]);

  // performance
  const valid = items.filter((i) => i.status !== "CANCELLED");
  const recent = items.filter((i) => (i.order.placedAt ?? i.order.createdAt) >= since30);
  const recentValid = recent.filter((i) => i.status !== "CANCELLED" && i.status !== "RETURNED");
  const shipped = items.filter((i) => i.shippedAt && i.order.placedAt);
  const avgDispatchH = shipped.length
    ? shipped.reduce((t, i) => t + (i.shippedAt!.getTime() - i.order.placedAt!.getTime()), 0) / shipped.length / 3_600_000
    : null;
  const finished = items.filter((i) => i.status === "DELIVERED" || i.status === "RETURNED");
  const openPayouts = payouts.filter((p) => p.status === "PENDING" || p.status === "PROCESSING").reduce((t, p) => t + p.amount, 0);
  const balance = balanceRow._sum.amount ?? 0;

  const toOpen = (st: string) => ["PLACED", "CONFIRMED", "PACKED"].includes(st);
  return {
    seller: {
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      approvedAt: s.approvedAt?.toISOString() ?? null,
      user: { ...s.user, lastLoginAt: s.user.lastLoginAt?.toISOString() ?? null, createdAt: s.user.createdAt.toISOString() },
    },
    products: products.map((p) => ({ ...p, brandName: p.brand.name, categoryName: p.category.name })),
    items: items.map((i) => ({
      ...i,
      shippedAt: i.shippedAt?.toISOString() ?? null,
      deliveredAt: i.deliveredAt?.toISOString() ?? null,
      order: { ...i.order, placedAt: i.order.placedAt?.toISOString() ?? null, createdAt: i.order.createdAt.toISOString() },
    })),
    ledger: ledger.map((l) => ({ id: l.id, type: l.type, amount: l.amount, note: l.note, payoutId: l.payoutId, orderNumber: l.orderItem?.order.number ?? null, createdAt: l.createdAt.toISOString() })),
    payouts: payouts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
      periodStart: p.periodStart?.toISOString() ?? null,
      periodEnd: p.periodEnd?.toISOString() ?? null,
    })),
    campaigns: campaigns.map((c) => ({ ...c, spent: Math.round(c.spent), startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString() })),
    money: { balance, openPayouts, available: Math.max(0, balance - openPayouts), paidOut: -ledger.filter((l) => l.type === "PAYOUT").reduce((t, l) => t + l.amount, 0) },
    performance: {
      gmv30: recentValid.reduce((t, i) => t + i.lineTotal, 0),
      units30: recentValid.reduce((t, i) => t + i.qty, 0),
      orders30: new Set(recent.map((i) => i.order.id)).size,
      gmvAll: valid.filter((i) => i.status !== "RETURNED").reduce((t, i) => t + i.lineTotal, 0),
      commissionAll: valid.filter((i) => i.status !== "RETURNED").reduce((t, i) => t + i.commissionAmt, 0),
      openItems: items.filter((i) => toOpen(i.status)).length,
      deliveredRate: ratio(items.filter((i) => i.status === "DELIVERED").length, finished.length),
      cancelRate: ratio(items.filter((i) => i.status === "CANCELLED").length, items.length),
      returnRate: ratio(items.filter((i) => i.status === "RETURNED").length, finished.length),
      avgDispatchH,
    },
  };
}
export type SellerDetail = NonNullable<Awaited<ReturnType<typeof getSeller>>>;

// ───────────────────────────── actions ─────────────────────────────

export const SELLER_ACTIONS = ["approve", "reject", "suspend", "reactivate"] as const;
export type SellerAction = (typeof SELLER_ACTIONS)[number];

export const sellerActionSchema = z
  .object({ action: z.enum(SELLER_ACTIONS), reason: z.string().trim().max(400).optional() })
  .refine((v) => !(v.action === "reject" || v.action === "suspend") || (v.reason && v.reason.length >= 3), {
    message: "Add a reason the seller will see (at least 3 characters)",
    path: ["reason"],
  });

const FROM: Record<SellerAction, SellerStatus[]> = {
  approve: ["PENDING", "REJECTED"],
  reject: ["PENDING"],
  suspend: ["APPROVED"],
  reactivate: ["SUSPENDED"],
};

const SUSPEND_FLAG = "suspendedWithSeller";

export async function sellerAction(id: string, action: SellerAction, reason: string | undefined, actorId: string) {
  const s = await db.seller.findUnique({ where: { id }, include: { user: { select: { id: true, role: true } } } });
  if (!s) throw err.notFound("Seller not found");
  if (!FROM[action].includes(s.status)) throw err.conflict(`Can't ${action} a seller who is ${s.status.toLowerCase()}`);

  let productsChanged = 0;
  await db.$transaction(async (tx) => {
    if (action === "approve") {
      await tx.seller.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), rejectionReason: null } });
      if (s.user.role === "CUSTOMER") await tx.user.update({ where: { id: s.userId }, data: { role: "SELLER" } });
    } else if (action === "reject") {
      await tx.seller.update({ where: { id }, data: { status: "REJECTED", rejectionReason: reason } });
    } else if (action === "suspend") {
      await tx.seller.update({ where: { id }, data: { status: "SUSPENDED", rejectionReason: reason } });
      const live = await tx.product.findMany({ where: { sellerId: id, status: "ACTIVE" }, select: { id: true, meta: true } });
      for (const p of live) {
        const meta = (p.meta && typeof p.meta === "object" && !Array.isArray(p.meta) ? p.meta : {}) as Record<string, unknown>;
        await tx.product.update({ where: { id: p.id }, data: { status: "ARCHIVED", meta: asJson({ ...meta, [SUSPEND_FLAG]: true }) } });
      }
      productsChanged = live.length;
    } else if (action === "reactivate") {
      await tx.seller.update({ where: { id }, data: { status: "APPROVED", rejectionReason: null } });
      const parked = await tx.product.findMany({
        where: { sellerId: id, status: "ARCHIVED", meta: { path: [SUSPEND_FLAG], equals: true } },
        select: { id: true, meta: true },
      });
      for (const p of parked) {
        const meta = { ...((p.meta ?? {}) as Record<string, unknown>) };
        delete meta[SUSPEND_FLAG];
        await tx.product.update({ where: { id: p.id }, data: { status: "ACTIVE", meta: Object.keys(meta).length ? asJson(meta) : Prisma.DbNull } });
      }
      productsChanged = parked.length;
    }
  });

  invalidate(TAGS.sellers, ...(productsChanged ? [TAGS.products] : []));
  await audit(actorId, `seller.${action}`, "Seller", id, asJson({ seller: s.displayName, from: s.status, reason, productsChanged }));
  return { id, action, productsChanged };
}

export const commissionSchema = z.object({
  commissionPct: z.coerce.number().min(0, "Commission can't be negative").max(60, "Commission can't exceed 60%"),
});

export async function updateCommission(id: string, pct: number, actorId: string) {
  const s = await db.seller.findUnique({ where: { id }, select: { id: true, commissionPct: true, displayName: true } });
  if (!s) throw err.notFound("Seller not found");
  const value = Math.round(pct * 100) / 100;
  const updated = await db.seller.update({ where: { id }, data: { commissionPct: value } });
  invalidate(TAGS.sellers);
  await audit(actorId, "seller.commission", "Seller", id, asJson({ seller: s.displayName, from: s.commissionPct, to: value }));
  return { id, commissionPct: updated.commissionPct };
}
