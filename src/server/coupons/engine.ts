import { formatINR } from "@/lib/money";

/**
 * COUPON RULES — pure maths, shared by the cart quote, POST /api/v1/coupons/apply and order placement
 * (which re-runs it inside the placement transaction). No I/O here: callers pass the coupon row, the priced
 * cart lines and how often this shopper already used the code.
 *
 *   PERCENT  value% of the eligible subtotal, capped at maxDiscount
 *   FLAT     ₹value off (never more than the eligible subtotal)
 *   BOGO     buy one get one: every second eligible unit is free (the cheaper unit of each pair)
 * A brand-scoped coupon (brandId) only counts that brand's items — for the discount AND the minimum order.
 */

export type CouponRule = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: "PERCENT" | "FLAT" | "BOGO";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  brandId: string | null;
  brandName: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  isActive: boolean;
};

export type PricedLine = { productId: string; brandId: string; price: number; qty: number };

export type CouponFailure =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USED_UP"
  | "USER_LIMIT"
  | "NO_ELIGIBLE_ITEMS"
  | "MIN_ORDER"
  | "NO_DISCOUNT";

export type CouponCheck =
  | { ok: true; discount: number; eligibleSubtotal: number }
  | { ok: false; reason: CouponFailure; message: string; shortBy?: number };

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** BOGO: sort eligible units by price (high → low); every second unit is free. */
function bogoDiscount(lines: PricedLine[]): number {
  const units: number[] = [];
  for (const l of lines) for (let i = 0; i < l.qty; i++) units.push(l.price);
  units.sort((a, b) => b - a);
  let free = 0;
  for (let i = 1; i < units.length; i += 2) free += units[i];
  return free;
}

/**
 * Validates a coupon against a cart and computes the discount (integer rupees).
 * `userUses` = this shopper's uses on non-cancelled orders, or null for a guest (per-user limit is then
 * checked again at checkout, once they're signed in).
 */
export function checkCoupon(c: CouponRule, lines: PricedLine[], opts: { now?: Date; userUses?: number | null } = {}): CouponCheck {
  const now = opts.now ?? new Date();
  const brand = c.brandName ?? "this brand";
  if (!c.isActive) return { ok: false, reason: "INACTIVE", message: `${c.code} is no longer active` };
  if (c.startsAt && c.startsAt > now) return { ok: false, reason: "NOT_STARTED", message: `${c.code} isn't live yet` };
  if (c.endsAt && c.endsAt < now) return { ok: false, reason: "EXPIRED", message: `${c.code} has expired` };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { ok: false, reason: "USED_UP", message: `${c.code} has been fully redeemed` };
  if (opts.userUses != null && opts.userUses >= Math.max(1, c.perUserLimit)) {
    return {
      ok: false,
      reason: "USER_LIMIT",
      message: c.perUserLimit <= 1 ? `You've already used ${c.code}` : `You've used ${c.code} the maximum ${c.perUserLimit} times`,
    };
  }

  const eligible = c.brandId ? lines.filter((l) => l.brandId === c.brandId) : lines;
  const eligibleSubtotal = eligible.reduce((a, l) => a + l.price * l.qty, 0);
  if (eligibleSubtotal <= 0) {
    return { ok: false, reason: "NO_ELIGIBLE_ITEMS", message: c.brandId ? `Add a ${brand} product to use ${c.code}` : "Add a product to use this code" };
  }
  if (eligibleSubtotal < c.minOrder) {
    const shortBy = c.minOrder - eligibleSubtotal;
    return {
      ok: false,
      reason: "MIN_ORDER",
      shortBy,
      message: `Add ${formatINR(shortBy)} more${c.brandId ? ` of ${brand}` : ""} to use ${c.code} (min. ${formatINR(c.minOrder)})`,
    };
  }

  let discount = 0;
  if (c.type === "PERCENT") discount = Math.floor((eligibleSubtotal * Math.min(100, Math.max(0, c.value))) / 100);
  else if (c.type === "FLAT") discount = Math.max(0, c.value);
  else discount = bogoDiscount(eligible);
  if (c.maxDiscount != null && c.maxDiscount > 0) discount = Math.min(discount, c.maxDiscount);
  discount = Math.min(Math.round(discount), eligibleSubtotal);

  if (discount <= 0) {
    return {
      ok: false,
      reason: "NO_DISCOUNT",
      message: c.type === "BOGO" ? `Add one more ${brand} item — the second one is free with ${c.code}` : `${c.code} doesn't reduce this cart`,
    };
  }
  return { ok: true, discount, eligibleSubtotal };
}
