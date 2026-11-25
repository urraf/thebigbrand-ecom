import "server-only";
import { db, type LedgerType, type Prisma } from "@/lib/db";
import { LEDGER_LABEL } from "@/components/seller/format";

/**
 * SELLER MONEY. Balance = Σ SellerLedgerEntry.amount (signed ₹). Entries are posted by the order lifecycle
 * (SALE_CREDIT + COMMISSION_DEBIT on delivery, REFUND_DEBIT on return), payouts and ad spend (admin side).
 */

export const LEDGER_TYPES: LedgerType[] = ["SALE_CREDIT", "COMMISSION_DEBIT", "REFUND_DEBIT", "PAYOUT", "AD_SPEND", "ADJUSTMENT"];

export type LedgerFilter = { type?: LedgerType; from?: string; to?: string; page?: number; limit?: number };

function ledgerWhere(sellerId: string, f: LedgerFilter): Prisma.SellerLedgerEntryWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (f.from) createdAt.gte = new Date(`${f.from}T00:00:00+05:30`);
  if (f.to) createdAt.lte = new Date(`${f.to}T23:59:59.999+05:30`);
  return { sellerId, ...(f.type ? { type: f.type } : {}), ...(createdAt.gte || createdAt.lte ? { createdAt } : {}) };
}

/** The Wednesday payout run after `now` (IST). */
export function nextPayoutDate(now = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const dow = ist.getUTCDay(); // 0 Sun … 3 Wed
  let add = (3 - dow + 7) % 7;
  if (add === 0) add = 7;
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + add, 10, 0) - 5.5 * 3600_000);
  return d;
}

export async function getSellerBalance(sellerId: string) {
  const [sum, pending, lastPayout, paidAgg] = await Promise.all([
    db.sellerLedgerEntry.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    db.orderItem.aggregate({
      where: { sellerId, status: { in: ["PLACED", "CONFIRMED", "PACKED", "SHIPPED"] }, order: { status: { not: "PENDING_PAYMENT" } } },
      _sum: { sellerEarning: true },
      _count: { _all: true },
    }),
    db.payout.findFirst({ where: { sellerId }, orderBy: { createdAt: "desc" }, select: { id: true, amount: true, status: true, paidAt: true, createdAt: true, reference: true } }),
    db.payout.aggregate({ where: { sellerId, status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  return {
    balance: sum._sum.amount ?? 0,
    pendingEarnings: pending._sum.sellerEarning ?? 0,
    pendingItems: pending._count._all,
    nextPayoutAt: nextPayoutDate().toISOString(),
    lastPayout: lastPayout
      ? { ...lastPayout, paidAt: lastPayout.paidAt?.toISOString() ?? null, createdAt: lastPayout.createdAt.toISOString() }
      : null,
    totalPaidOut: paidAgg._sum.amount ?? 0,
    payoutCount: paidAgg._count._all,
  };
}

export type LedgerRow = {
  id: string;
  type: LedgerType;
  label: string;
  amount: number;
  note: string | null;
  createdAt: string;
  orderNumber: string | null;
  productName: string | null;
  payoutRef: string | null;
  balanceAfter: number | null;
};

export async function listLedger(sellerId: string, f: LedgerFilter = {}) {
  const page = Math.max(1, f.page ?? 1);
  const limit = Math.min(100, Math.max(1, f.limit ?? 25));
  const where = ledgerWhere(sellerId, f);
  const unfiltered = !f.type && !f.from && !f.to;
  const [rows, total, byType, all, newer] = await Promise.all([
    db.sellerLedgerEntry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: { orderItem: { select: { name: true, order: { select: { number: true } } } }, payout: { select: { reference: true } } },
    }),
    db.sellerLedgerEntry.count({ where }),
    db.sellerLedgerEntry.groupBy({ by: ["type"], where, _sum: { amount: true }, _count: { _all: true } }),
    db.sellerLedgerEntry.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    // Σ of entries newer than this page (for the running balance column)
    unfiltered && page > 1
      ? db.sellerLedgerEntry.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: (page - 1) * limit, select: { amount: true } })
      : Promise.resolve([] as { amount: number }[]),
  ]);
  let running = (all._sum.amount ?? 0) - newer.reduce((s, r) => s + r.amount, 0);
  const items: LedgerRow[] = rows.map((r) => {
    const row: LedgerRow = {
      id: r.id,
      type: r.type,
      label: LEDGER_LABEL[r.type] ?? r.type,
      amount: r.amount,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      orderNumber: r.orderItem?.order.number ?? null,
      productName: r.orderItem?.name ?? null,
      payoutRef: r.payout?.reference ?? null,
      balanceAfter: unfiltered ? running : null,
    };
    running -= r.amount;
    return row;
  });
  const totals = Object.fromEntries(byType.map((t) => [t.type, { amount: t._sum.amount ?? 0, count: t._count._all }])) as Partial<
    Record<LedgerType, { amount: number; count: number }>
  >;
  const net = byType.reduce((s, t) => s + (t._sum.amount ?? 0), 0);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), totals, net };
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // neutralise spreadsheet formula injection and quote
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function ledgerCsv(sellerId: string, f: LedgerFilter = {}): Promise<string> {
  const where = ledgerWhere(sellerId, f);
  const rows = await db.sellerLedgerEntry.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 20000,
    include: { orderItem: { select: { name: true, order: { select: { number: true } } } }, payout: { select: { reference: true } } },
  });
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const head = ["Date (IST)", "Type", "Description", "Order", "Product", "Payout UTR", "Amount (INR)"];
  const lines = rows.map((r) =>
    [fmt.format(r.createdAt).replace(",", ""), LEDGER_LABEL[r.type] ?? r.type, r.note ?? "", r.orderItem?.order.number ?? "", r.orderItem?.name ?? "", r.payout?.reference ?? "", r.amount]
      .map(csvCell)
      .join(","),
  );
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return "﻿" + [head.join(","), ...lines, ["", "", "Net", "", "", "", total].map(csvCell).join(",")].join("\r\n") + "\r\n";
}

export async function listPayouts(sellerId: string, opts: { page?: number; limit?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  const [rows, total] = await Promise.all([
    db.payout.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { entries: true } } },
    }),
    db.payout.count({ where: { sellerId } }),
  ]);
  return {
    items: rows.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      reference: p.reference,
      periodStart: p.periodStart?.toISOString() ?? null,
      periodEnd: p.periodEnd?.toISOString() ?? null,
      note: p.note,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      entries: p._count.entries,
    })),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
