import "server-only";
import { z } from "zod";
import { db, Prisma, type PayoutStatus } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { asJson, keyToIstStart, monthStartKey, toCsv } from "./util";

/**
 * PAYOUTS & LEDGER — what the marketplace owes each seller and the money sent to them.
 *  balance   = Σ SellerLedgerEntry.amount (sale credits − commission − refunds − payouts − ad spend ± adjustments)
 *  available = balance − payouts already PENDING / PROCESSING (reserved, not yet in the ledger)
 * Payout flow: PENDING → PROCESSING → PAID (bank UTR required; writes the PAYOUT ledger debit) · PENDING/PROCESSING → FAILED.
 * Creating payouts, changing their status and manual adjustments are superadmin-only and audited.
 */

export const LEDGER_TYPES = ["SALE_CREDIT", "COMMISSION_DEBIT", "REFUND_DEBIT", "PAYOUT", "AD_SPEND", "ADJUSTMENT"] as const;
export const PAYOUT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const;

export const LEDGER_LABEL: Record<(typeof LEDGER_TYPES)[number], string> = {
  SALE_CREDIT: "Sale credit",
  COMMISSION_DEBIT: "Commission",
  REFUND_DEBIT: "Return / refund",
  PAYOUT: "Payout",
  AD_SPEND: "Ad spend",
  ADJUSTMENT: "Adjustment",
};

export function maskAccount(n: string | null | undefined): string | null {
  if (!n) return null;
  const d = n.replace(/\s/g, "");
  return d.length <= 4 ? d : `•••• ${d.slice(-4)}`;
}

export async function getPayoutsOverview(query: { status?: PayoutStatus; sellerId?: string } = {}, now = new Date()) {
  const [sellers, sums, open, lastPaid, payouts, paidMonth] = await Promise.all([
    db.seller.findMany({
      where: { status: { in: ["APPROVED", "SUSPENDED"] } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, businessName: true, status: true, bankAccountName: true, bankAccountNumber: true, bankIfsc: true, upiId: true, commissionPct: true },
    }),
    db.sellerLedgerEntry.groupBy({ by: ["sellerId", "type"], _sum: { amount: true } }),
    db.payout.groupBy({ by: ["sellerId"], where: { status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true }, _count: true }),
    db.payout.groupBy({ by: ["sellerId"], where: { status: "PAID" }, _max: { paidAt: true } }),
    db.payout.findMany({
      where: { ...(query.status ? { status: query.status } : {}), ...(query.sellerId ? { sellerId: query.sellerId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { seller: { select: { id: true, displayName: true, bankAccountNumber: true, bankIfsc: true, upiId: true } } },
    }),
    db.payout.aggregate({ where: { status: "PAID", paidAt: { gte: keyToIstStart(monthStartKey(now)) } }, _sum: { amount: true }, _count: true }),
  ]);

  // include sellers that still have money on the ledger even if they are no longer approved
  const ledgerSellerIds = [...new Set(sums.map((s) => s.sellerId))].filter((sid) => !sellers.some((s) => s.id === sid));
  const extra = ledgerSellerIds.length
    ? await db.seller.findMany({
        where: { id: { in: ledgerSellerIds } },
        select: { id: true, displayName: true, businessName: true, status: true, bankAccountName: true, bankAccountNumber: true, bankIfsc: true, upiId: true, commissionPct: true },
      })
    : [];

  const openBy = new Map(open.map((o) => [o.sellerId, { amount: o._sum.amount ?? 0, count: o._count }]));
  const lastBy = new Map(lastPaid.map((l) => [l.sellerId, l._max.paidAt]));
  const balances = [...sellers, ...extra].map((s) => {
    const mine = sums.filter((r) => r.sellerId === s.id);
    const by = (t: string) => mine.find((r) => r.type === t)?._sum.amount ?? 0;
    const balance = mine.reduce((t, r) => t + (r._sum.amount ?? 0), 0);
    const reserved = openBy.get(s.id)?.amount ?? 0;
    return {
      sellerId: s.id,
      name: s.displayName,
      businessName: s.businessName,
      status: s.status,
      commissionPct: s.commissionPct,
      bank: { name: s.bankAccountName, account: maskAccount(s.bankAccountNumber), ifsc: s.bankIfsc, upi: s.upiId },
      hasBank: Boolean((s.bankAccountNumber && s.bankIfsc) || s.upiId),
      sales: by("SALE_CREDIT"),
      commission: -by("COMMISSION_DEBIT"),
      refunds: -by("REFUND_DEBIT"),
      adSpend: -by("AD_SPEND"),
      adjustments: by("ADJUSTMENT"),
      paidOut: -by("PAYOUT"),
      balance,
      reserved,
      openCount: openBy.get(s.id)?.count ?? 0,
      available: Math.max(0, balance - reserved),
      lastPaidAt: lastBy.get(s.id)?.toISOString() ?? null,
    };
  });

  return {
    balances,
    payouts: payouts.map((p) => ({
      id: p.id,
      sellerId: p.sellerId,
      sellerName: p.seller.displayName,
      bank: maskAccount(p.seller.bankAccountNumber) ?? p.seller.upiId,
      ifsc: p.seller.bankIfsc,
      amount: p.amount,
      status: p.status,
      reference: p.reference,
      note: p.note,
      periodStart: p.periodStart?.toISOString() ?? null,
      periodEnd: p.periodEnd?.toISOString() ?? null,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    summary: {
      owed: balances.reduce((t, b) => t + Math.max(0, b.balance), 0),
      reserved: balances.reduce((t, b) => t + b.reserved, 0),
      available: balances.reduce((t, b) => t + b.available, 0),
      openCount: open.reduce((t, o) => t + o._count, 0),
      paidThisMonth: paidMonth._sum.amount ?? 0,
      paidThisMonthCount: paidMonth._count,
      commissionEarned: balances.reduce((t, b) => t + b.commission, 0),
    },
  };
}
export type PayoutsOverview = Awaited<ReturnType<typeof getPayoutsOverview>>;

// ───────────────────────────── payouts ─────────────────────────────

export const payoutCreateSchema = z
  .object({
    sellerId: z.string().trim().min(5).max(40),
    amount: z.coerce.number().int("Whole rupees only").min(1, "Amount must be at least ₹1").max(100_000_000),
    note: z.string().trim().max(300).optional(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
  })
  .refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart, { message: "Period end must be after the start", path: ["periodEnd"] });

export async function createPayout(input: z.infer<typeof payoutCreateSchema>, actorId: string) {
  try {
    return await createPayoutTx(input, actorId);
  } catch (e) {
    // Serializable conflict with a concurrent payout for the same seller → ask to retry instead of a 500
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      throw err.conflict("Another payout for this seller was created at the same moment — refresh and try again");
    }
    throw e;
  }
}

async function createPayoutTx(input: z.infer<typeof payoutCreateSchema>, actorId: string) {
  return db.$transaction(
    async (tx) => {
      const seller = await tx.seller.findUnique({ where: { id: input.sellerId }, select: { id: true, displayName: true, bankAccountNumber: true, bankIfsc: true, upiId: true } });
      if (!seller) throw err.notFound("Seller not found");
      if (!((seller.bankAccountNumber && seller.bankIfsc) || seller.upiId)) throw err.unprocessable("This seller has no bank account or UPI ID on file");
      const [bal, open] = await Promise.all([
        tx.sellerLedgerEntry.aggregate({ where: { sellerId: seller.id }, _sum: { amount: true } }),
        tx.payout.aggregate({ where: { sellerId: seller.id, status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } }),
      ]);
      const available = (bal._sum.amount ?? 0) - (open._sum.amount ?? 0);
      if (input.amount > available) {
        throw err.unprocessable(`Amount is more than the available balance (₹${Math.max(0, available).toLocaleString("en-IN")})`, {
          fieldErrors: { amount: [`Max ₹${Math.max(0, available).toLocaleString("en-IN")}`] },
        });
      }
      const payout = await tx.payout.create({
        data: { sellerId: seller.id, amount: input.amount, note: input.note || null, periodStart: input.periodStart, periodEnd: input.periodEnd, status: "PENDING" },
      });
      await audit(actorId, "payout.create", "Payout", payout.id, asJson({ seller: seller.displayName, amount: input.amount }));
      return payout;
    },
    { isolationLevel: "Serializable" },
  );
}

export const payoutUpdateSchema = z
  .object({
    status: z.enum(["PROCESSING", "PAID", "FAILED"]),
    reference: z.string().trim().toUpperCase().max(40).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.status !== "PAID" || (v.reference && /^[A-Z0-9-]{6,40}$/.test(v.reference)), {
    message: "Enter the bank UTR / reference (6–40 letters or digits)",
    path: ["reference"],
  });

const NEXT: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ["PROCESSING", "FAILED"],
  PROCESSING: ["PAID", "FAILED"],
  PAID: [],
  FAILED: [],
};

export async function updatePayout(id: string, input: z.infer<typeof payoutUpdateSchema>, actorId: string) {
  const result = await db.$transaction(async (tx) => {
    const p = await tx.payout.findUnique({ where: { id }, include: { seller: { select: { displayName: true } } } });
    if (!p) throw err.notFound("Payout not found");
    if (!NEXT[p.status].includes(input.status)) throw err.conflict(`A ${p.status.toLowerCase()} payout can't be marked ${input.status.toLowerCase()}`);
    const note = input.note ? (p.note ? `${p.note} · ${input.note}` : input.note) : p.note;
    // claim the transition atomically: a concurrent request that already moved this payout gets a conflict
    // (prevents two "mark paid" clicks from writing two PAYOUT ledger debits)
    const claimed = await tx.payout.updateMany({ where: { id, status: p.status }, data: { status: input.status } });
    if (claimed.count !== 1) throw err.conflict("This payout was just updated by someone else — refresh and try again");
    if (input.status === "PAID") {
      const dupe = await tx.sellerLedgerEntry.findFirst({ where: { payoutId: p.id, type: "PAYOUT" }, select: { id: true } });
      if (!dupe) {
        await tx.sellerLedgerEntry.create({
          data: { sellerId: p.sellerId, type: "PAYOUT", amount: -p.amount, payoutId: p.id, note: `Payout · UTR ${input.reference}` },
        });
      }
      return tx.payout.update({ where: { id }, data: { status: "PAID", reference: input.reference, paidAt: new Date(), note } });
    }
    return tx.payout.update({ where: { id }, data: { status: input.status, note, ...(input.reference ? { reference: input.reference } : {}) } });
  });
  invalidate(TAGS.sellers);
  await audit(actorId, `payout.${input.status.toLowerCase()}`, "Payout", id, asJson({ amount: result.amount, reference: input.reference, note: input.note }));
  return result;
}

// ───────────────────────────── adjustments ─────────────────────────────

export const adjustmentSchema = z.object({
  sellerId: z.string().trim().min(5).max(40),
  amount: z.coerce
    .number()
    .int("Whole rupees only")
    .refine((v) => v !== 0, "Amount can't be zero")
    .refine((v) => Math.abs(v) <= 10_000_000, "Amount is too large"),
  reason: z.string().trim().min(5, "Explain the adjustment (at least 5 characters)").max(300),
});

export async function createAdjustment(input: z.infer<typeof adjustmentSchema>, actorId: string) {
  const seller = await db.seller.findUnique({ where: { id: input.sellerId }, select: { id: true, displayName: true } });
  if (!seller) throw err.notFound("Seller not found");
  const entry = await db.sellerLedgerEntry.create({
    data: { sellerId: seller.id, type: "ADJUSTMENT", amount: input.amount, note: input.reason },
  });
  invalidate(TAGS.sellers);
  await audit(actorId, "ledger.adjust", "SellerLedgerEntry", entry.id, asJson({ seller: seller.displayName, amount: input.amount, reason: input.reason }));
  return entry;
}

// ───────────────────────────── ledger ─────────────────────────────

export const ledgerQuery = z.object({
  sellerId: z.string().trim().max(40).optional(),
  type: z.enum(LEDGER_TYPES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export type LedgerQuery = z.infer<typeof ledgerQuery>;

function ledgerWhere(q: LedgerQuery): Prisma.SellerLedgerEntryWhereInput {
  const where: Prisma.SellerLedgerEntryWhereInput = {};
  if (q.sellerId) where.sellerId = q.sellerId;
  if (q.type) where.type = q.type;
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: keyToIstStart(q.from) } : {}),
      ...(q.to ? { lt: new Date(keyToIstStart(q.to).getTime() + 86_400_000) } : {}),
    };
  }
  return where;
}

const ledgerSelect = {
  id: true,
  type: true,
  amount: true,
  note: true,
  createdAt: true,
  payoutId: true,
  seller: { select: { id: true, displayName: true } },
  orderItem: { select: { name: true, qty: true, order: { select: { number: true } } } },
  payout: { select: { reference: true } },
} satisfies Prisma.SellerLedgerEntrySelect;

export async function listLedger(q: LedgerQuery) {
  const where = ledgerWhere(q);
  const [rows, total, sum] = await Promise.all([
    db.sellerLedgerEntry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.limit, take: q.limit, select: ledgerSelect }),
    db.sellerLedgerEntry.count({ where }),
    db.sellerLedgerEntry.aggregate({ where, _sum: { amount: true } }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      typeLabel: LEDGER_LABEL[r.type],
      amount: r.amount,
      note: r.note,
      sellerId: r.seller.id,
      sellerName: r.seller.displayName,
      orderNumber: r.orderItem?.order.number ?? null,
      item: r.orderItem ? `${r.orderItem.name} × ${r.orderItem.qty}` : null,
      reference: r.payout?.reference ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    net: sum._sum.amount ?? 0,
    page: q.page,
    limit: q.limit,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  };
}

export async function ledgerCsv(q: LedgerQuery): Promise<{ filename: string; csv: string }> {
  const rows = await db.sellerLedgerEntry.findMany({ where: ledgerWhere(q), orderBy: { createdAt: "asc" }, take: 50_000, select: ledgerSelect });
  const ist = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const csv = toCsv(
    ["Date (IST)", "Seller", "Type", "Amount (INR)", "Order", "Item", "Payout UTR", "Note", "Entry ID"],
    rows.map((r) => [
      ist.format(r.createdAt).replace(",", ""),
      r.seller.displayName,
      LEDGER_LABEL[r.type],
      r.amount,
      r.orderItem?.order.number ?? "",
      r.orderItem ? `${r.orderItem.name} x ${r.orderItem.qty}` : "",
      r.payout?.reference ?? "",
      r.note ?? "",
      r.id,
    ]),
  );
  const who = q.sellerId ? (rows[0]?.seller.displayName ?? "seller").toLowerCase().replace(/[^a-z0-9]+/g, "-") : "all-sellers";
  return { filename: `tbb-ledger_${who}${q.from ? `_${q.from}` : ""}${q.to ? `_to_${q.to}` : ""}.csv`, csv };
}
