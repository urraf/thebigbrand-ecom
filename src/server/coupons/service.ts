import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, type Prisma } from "@/lib/db";
import { err } from "@/lib/api";
import { TAGS } from "@/lib/cache";
import { formatINR } from "@/lib/money";
import type { CartView } from "@/types/shared";
import type { CouponOffer } from "@/server/checkout/types";
import { checkCoupon, normalizeCode, type CouponCheck, type CouponRule, type PricedLine } from "./engine";

/**
 * COUPONS — validation against the live cart (Cart.couponCode) for the cart page, checkout and the API.
 * Rules live in ./engine.ts; order placement re-checks the code inside its transaction (place-order.ts).
 */

export const couponRuleSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  type: true,
  value: true,
  minOrder: true,
  maxDiscount: true,
  brandId: true,
  brand: { select: { name: true } },
  startsAt: true,
  endsAt: true,
  usageLimit: true,
  perUserLimit: true,
  usedCount: true,
  isActive: true,
} satisfies Prisma.CouponSelect;

type CouponRow = Prisma.CouponGetPayload<{ select: typeof couponRuleSelect }>;

export function toCouponRule(c: CouponRow): CouponRule {
  const { brand, ...rest } = c;
  return { ...rest, brandName: brand?.name ?? null };
}

/** Case-insensitive lookup of a code (fresh read — usage counters must be current). */
export async function findCouponRule(code: string, client: Prisma.TransactionClient | typeof db = db): Promise<CouponRule | null> {
  const norm = normalizeCode(code);
  if (!norm || norm.length > 40) return null;
  const row = await client.coupon.findFirst({ where: { code: { equals: norm, mode: "insensitive" } }, select: couponRuleSelect });
  return row ? toCouponRule(row) : null;
}

/** This shopper's uses of a coupon on orders that weren't cancelled. */
export function userCouponUses(userId: string, couponId: string, client: Prisma.TransactionClient | typeof db = db): Promise<number> {
  return client.couponUse.count({ where: { couponId, userId, order: { status: { not: "CANCELLED" } } } });
}

export function pricedLines(view: CartView): PricedLine[] {
  return view.lines.map((l) => ({ productId: l.productId, brandId: l.product.brand.id, price: l.product.price, qty: l.qty }));
}

export type CouponEvaluation = { rule: CouponRule; check: CouponCheck } | { rule: null; check: Extract<CouponCheck, { ok: false }> };

export async function evaluateCoupon(code: string, view: CartView, userId: string | null): Promise<CouponEvaluation> {
  const rule = await findCouponRule(code);
  if (!rule) return { rule: null, check: { ok: false, reason: "NOT_FOUND", message: `“${normalizeCode(code)}” isn't a valid code` } };
  const userUses = userId ? await userCouponUses(userId, rule.id) : null;
  return { rule, check: checkCoupon(rule, pricedLines(view), { userUses }) };
}

/** Validate and attach a code to the cart. Throws 422 with the reason when it doesn't apply. */
export async function applyCouponToCart(view: CartView, code: string, userId: string | null): Promise<CouponRule> {
  if (!view.id || !view.lines.length) throw err.unprocessable("Add a product to your cart before applying a coupon");
  const ev = await evaluateCoupon(code, view, userId);
  if (!ev.check.ok) throw err.unprocessable(ev.check.message, { reason: ev.check.reason, shortBy: ev.check.shortBy ?? null });
  await db.cart.update({ where: { id: view.id }, data: { couponCode: ev.rule!.code } });
  return ev.rule!;
}

export async function removeCouponFromCart(view: CartView): Promise<void> {
  if (view.id && view.couponCode) await db.cart.update({ where: { id: view.id }, data: { couponCode: null } });
}

// ───────────────────────────── offers ("best price") ─────────────────────────────

type OfferRow = Omit<CouponRule, "startsAt" | "endsAt"> & { startsAt: string | null; endsAt: string | null; isSponsored: boolean };

/** Active coupons (cached; usage counters are re-read when a code is actually applied). */
async function getOfferCoupons(): Promise<OfferRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.coupons);
  const rows = await db.coupon.findMany({
    where: { isActive: true },
    orderBy: [{ isSponsored: "asc" }, { createdAt: "desc" }],
    take: 60,
    select: { ...couponRuleSelect, isSponsored: true },
  });
  return rows.map((r) => {
    const rule = toCouponRule(r);
    return { ...rule, isSponsored: r.isSponsored, startsAt: rule.startsAt?.toISOString() ?? null, endsAt: rule.endsAt?.toISOString() ?? null };
  });
}

/**
 * Coupons worth showing for this cart, best saving first: every code that applies (with its exact saving),
 * then codes the shopper is close to (brand in cart / min order not reached yet). Never trusted for totals.
 */
export async function listOffers(view: CartView, userId: string | null, limit = 6): Promise<CouponOffer[]> {
  if (!view.lines.length) return [];
  const all = await getOfferCoupons();
  const lines = pricedLines(view);
  const brandsInCart = new Set(lines.map((l) => l.brandId));
  const now = new Date();
  const uses = userId
    ? new Map(
        (
          await db.couponUse.groupBy({
            by: ["couponId"],
            where: { userId, couponId: { in: all.map((c) => c.id) }, order: { status: { not: "CANCELLED" } } },
            _count: { _all: true },
          })
        ).map((g) => [g.couponId, g._count._all]),
      )
    : null;

  const offers: (CouponOffer & { rank: number })[] = [];
  for (const o of all) {
    if (o.brandId && !brandsInCart.has(o.brandId)) continue;
    const rule: CouponRule = { ...o, startsAt: o.startsAt ? new Date(o.startsAt) : null, endsAt: o.endsAt ? new Date(o.endsAt) : null };
    const check = checkCoupon(rule, lines, { now, userUses: uses ? (uses.get(o.id) ?? 0) : null });
    const applied = view.couponCode?.toUpperCase() === o.code.toUpperCase();
    if (check.ok) {
      offers.push({ code: o.code, title: o.title, description: o.description, brandName: o.brandName, applicable: true, discount: check.discount, message: `Save ${formatINR(check.discount)}`, applied, rank: 1e6 + check.discount });
    } else if (check.reason === "MIN_ORDER" || check.reason === "NO_DISCOUNT") {
      offers.push({ code: o.code, title: o.title, description: o.description, brandName: o.brandName, applicable: false, discount: 0, message: check.message, applied, rank: 1e5 - (check.shortBy ?? 5e4) });
    }
  }
  return offers
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(({ rank: _rank, ...o }) => o);
}
