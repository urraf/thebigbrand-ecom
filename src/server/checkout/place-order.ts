import "server-only";
import { z } from "zod";
import { db, Prisma, type Address } from "@/lib/db";
import { ApiError, err } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { orderNumber } from "@/lib/ids";
import { toPaise } from "@/lib/money";
import { createGatewayOrder, gatewayMode, publicGatewayConfig } from "@/lib/payments";
import { site } from "@/lib/site";
import { markOrderPlaced } from "@/server/orders/lifecycle";
import { giftAllowanceFor, MAX_QTY } from "@/server/cart/service";
import { checkCoupon, type PricedLine } from "@/server/coupons/engine";
import { findCouponRule, userCouponUses } from "@/server/coupons/service";
import { cancelOrder, clearOrderedFromCart, invalidateStock } from "@/server/orders/cancel";
import { deliveryFee, parseShippingSettings } from "./settings";
import type { PlaceMethod, PlaceResult } from "./types";

/**
 * PLACE ORDER — POST /api/v1/checkout/place.
 *
 * Everything is recomputed from the database inside ONE transaction (serialised per shopper with a Postgres
 * advisory lock): product prices and stock (conditional decrement → no overselling), seller commission
 * snapshot, the free gifts (allowance from GiftTier, gift stock decrement), the coupon (all rules + per-user
 * limit, usedCount bump + CouponUse), delivery and COD fee from Setting "shipping", and the address snapshot.
 * The Order starts as PENDING_PAYMENT with its Payment row:
 *   COD      → markOrderPlaced() right away (paymentStatus COD_PENDING) and the cart is cleared.
 *   online   → a gateway order is created (Razorpay, or the built-in TEST gateway) and the client is told how
 *              to pay. The cart is cleared only once the payment is verified (payments/service.ts).
 * Idempotency: the client sends an `idempotencyKey` per checkout attempt (stored on Payment.raw); a repeat
 * request (double click, network retry) returns the order it already created instead of a second one.
 */

export const placeOrderSchema = z.object({
  addressId: z.string().trim().min(1).max(64),
  method: z.enum(["UPI", "CARD", "NETBANKING", "COD"]),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid idempotency key"),
  notes: z.string().trim().max(300).optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

type Tx = Prisma.TransactionClient;
type StockIssue = { productId: string; name: string; available: number };

class StockConflict extends Error {
  constructor(public items: StockIssue[]) {
    super("STOCK_CONFLICT");
  }
}

const paymentSelect = {
  id: true,
  provider: true,
  amount: true,
  status: true,
  providerOrderId: true,
  raw: true,
  order: { select: { id: true, number: true, total: true, status: true, userId: true } },
} satisfies Prisma.PaymentSelect;
type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

function findAttempt(userId: string, key: string, client: Tx | typeof db = db) {
  return client.payment.findFirst({
    where: { purpose: "ORDER", raw: { path: ["idempotencyKey"], equals: key }, order: { userId } },
    orderBy: { createdAt: "desc" },
    select: paymentSelect,
  });
}

function rawMethod(raw: Prisma.JsonValue | null): string | undefined {
  const m = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).method : undefined;
  return typeof m === "string" ? m : undefined;
}

/** The client payload for an order + its payment (fresh placement, idempotent repeat or payment retry). */
export function paymentResult(pay: PaymentRow, user: Pick<AuthUser, "name" | "email" | "phone">, reused: boolean): PlaceResult {
  const order = pay.order!;
  const base: PlaceResult = {
    order: { id: order.id, number: order.number, total: order.total, status: order.status },
    payment: { id: pay.id, provider: pay.provider as PlaceResult["payment"]["provider"], amount: pay.amount, razorpay: null },
    redirect: `/order/${order.number}`,
    reused,
  };
  if (order.status !== "PENDING_PAYMENT" || pay.provider === "COD") return base;
  if (pay.provider === "TEST") return { ...base, redirect: `/pay/test/${pay.id}` };
  if (pay.provider === "RAZORPAY" && pay.providerOrderId) {
    const method = rawMethod(pay.raw)?.toLowerCase();
    return {
      ...base,
      redirect: null,
      payment: {
        ...base.payment,
        razorpay: {
          keyId: publicGatewayConfig().keyId ?? "",
          orderId: pay.providerOrderId,
          amountPaise: toPaise(pay.amount),
          currency: "INR",
          name: site.name,
          description: `Order ${order.number}`,
          prefill: {
            ...(user.name ? { name: user.name } : {}),
            ...(user.email ? { email: user.email } : {}),
            ...(user.phone ? { contact: `+91${user.phone}` } : {}),
            ...(method && method !== "cod" ? { method } : {}),
          },
        },
      },
    };
  }
  throw err.conflict("We're still setting up your payment — please try again in a moment");
}

/** Cancel this shopper's other unpaid online orders (abandoned attempts) so they stop holding stock. */
async function cancelSupersededAttempts(userId: string, key: string) {
  const stale = await db.order.findMany({
    where: { userId, status: "PENDING_PAYMENT", NOT: { payments: { some: { raw: { path: ["idempotencyKey"], equals: key } } } } },
    select: { id: true },
    take: 10,
  });
  for (const o of stale) {
    await db.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { status: "FAILED" } });
    await cancelOrder(o.id, "system", "Payment not completed — replaced by a new checkout attempt").catch((e) => console.error("[checkout] stale order cancel failed", o.id, e));
  }
}

/** Puts the cart in line with what's actually in stock after a stock conflict. */
async function adjustCartForStock(userId: string, issues: StockIssue[]) {
  const cart = await db.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) return;
  await db.$transaction(
    issues.map((i) =>
      db.cartItem.update({
        where: { cartId_productId: { cartId: cart.id, productId: i.productId } },
        data: i.available > 0 ? { qty: Math.min(MAX_QTY, i.available) } : { savedForLater: true },
      }),
    ),
  );
}

function stockMessage(issues: StockIssue[]): string {
  if (issues.length === 1) {
    const i = issues[0];
    return i.available > 0
      ? `Only ${i.available} left of ${i.name} — we've updated your cart. Please review and place the order again.`
      : `${i.name} just sold out — we've moved it to Saved for later. Please review and place the order again.`;
  }
  return `${issues.length} items in your cart just changed (stock ran low) — we've updated your cart. Please review and place the order again.`;
}

type Created = {
  reused: boolean;
  payment: PaymentRow;
  stock: { productId: string; slug: string; stockBefore: number; stockAfter: number }[];
};

async function createOrderTx(
  tx: Tx,
  args: { userId: string; key: string; method: PlaceMethod; notes?: string; address: Address },
): Promise<Created> {
  const { userId, key, method, address } = args;
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`tbb:place:${userId}`}))`;

  // a concurrent request with the same key may have finished while we waited for the lock
  const dup = await findAttempt(userId, key, tx);
  if (dup) return { reused: true, payment: dup, stock: [] };

  const cart = await tx.cart.findUnique({
    where: { userId },
    select: {
      id: true,
      couponCode: true,
      giftIds: true,
      items: {
        where: { savedForLater: false },
        orderBy: { addedAt: "asc" },
        select: {
          productId: true,
          qty: true,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              size: true,
              mrp: true,
              price: true,
              stock: true,
              status: true,
              brandId: true,
              brand: { select: { name: true } },
              sellerId: true,
              seller: { select: { status: true, commissionPct: true } },
              images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!cart || !cart.items.length) throw err.unprocessable("Your cart is empty — add a product to place an order");

  // 1) availability + stock
  const issues: StockIssue[] = [];
  for (const it of cart.items) {
    const p = it.product;
    const sellable = p.status === "ACTIVE" && (!p.sellerId || p.seller?.status === "APPROVED");
    const qty = Math.min(MAX_QTY, Math.max(1, it.qty));
    if (!sellable) issues.push({ productId: p.id, name: p.name, available: 0 });
    else if (p.stock < qty) issues.push({ productId: p.id, name: p.name, available: Math.max(0, p.stock) });
  }
  if (issues.length) throw new StockConflict(issues);

  // 2) prices (from the DB, never the client)
  const lines = cart.items.map((it) => {
    const p = it.product;
    const qty = Math.min(MAX_QTY, Math.max(1, it.qty));
    const lineTotal = p.price * qty;
    const commissionPct = p.sellerId ? (p.seller?.commissionPct ?? 0) : 0;
    const commissionAmt = p.sellerId ? Math.round((lineTotal * commissionPct) / 100) : 0;
    return {
      product: p,
      qty,
      lineTotal,
      commissionPct,
      commissionAmt,
      sellerEarning: p.sellerId ? lineTotal - commissionAmt : 0,
    };
  });
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const mrpTotal = lines.reduce((a, l) => a + Math.max(l.product.mrp, l.product.price) * l.qty, 0);
  const priced: PricedLine[] = lines.map((l) => ({ productId: l.product.id, brandId: l.product.brandId, price: l.product.price, qty: l.qty }));

  // 3) free gifts
  const tiers = await tx.giftTier.findMany({ where: { isActive: true }, select: { minAmount: true, giftCount: true } });
  const allowance = giftAllowanceFor(subtotal, tiers);
  const giftIds = [...new Set(cart.giftIds)];
  if (giftIds.length > allowance) {
    throw err.unprocessable(`Your order unlocks ${allowance} free gift${allowance === 1 ? "" : "s"} — please remove ${giftIds.length - allowance}`, { step: "gifts" });
  }
  const gifts = giftIds.length
    ? await tx.giftItem.findMany({ where: { id: { in: giftIds } }, select: { id: true, miniName: true, miniSize: true, worth: true, stock: true, isActive: true } })
    : [];
  const giftById = new Map(gifts.map((g) => [g.id, g]));
  for (const id of giftIds) {
    const g = giftById.get(id);
    if (!g || !g.isActive) throw err.unprocessable("One of your free gifts is no longer available — please pick another", { step: "gifts", giftId: id });
    if (g.stock <= 0) throw err.unprocessable(`${g.miniName} just ran out — please pick another free gift`, { step: "gifts", giftId: id });
  }
  if (allowance > 0 && giftIds.length === 0) {
    const available = await tx.giftItem.count({ where: { isActive: true, stock: { gt: 0 } } });
    if (available > 0) throw err.unprocessable("Pick your free gift before placing the order — it's on us", { step: "gifts" });
  }

  // 4) coupon
  let discount = 0;
  const rule = cart.couponCode ? await findCouponRule(cart.couponCode, tx) : null;
  if (cart.couponCode) {
    if (!rule) throw err.unprocessable(`The code ${cart.couponCode} no longer exists — remove it to continue`, { step: "coupon" });
    const check = checkCoupon(rule, priced, { userUses: await userCouponUses(userId, rule.id, tx) });
    if (!check.ok) throw err.unprocessable(`${check.message} — remove it to continue`, { step: "coupon", reason: check.reason });
    discount = check.discount;
  }

  // 5) delivery + COD (uncached read of the setting)
  const settings = parseShippingSettings((await tx.setting.findUnique({ where: { key: "shipping" }, select: { value: true } }))?.value);
  if (method === "COD" && !settings.codEnabled) throw err.unprocessable("Cash on delivery isn't available right now — please pay online", { step: "payment" });
  const shippingFee = deliveryFee(subtotal, settings);
  const codFee = method === "COD" ? settings.codFee : 0;
  const total = Math.max(0, subtotal - discount) + shippingFee + codFee;

  // 6) reserve stock (conditional decrements: a concurrent order can't take the same units)
  const stock: Created["stock"] = [];
  for (const l of lines) {
    const r = await tx.product.updateMany({
      where: { id: l.product.id, status: "ACTIVE", stock: { gte: l.qty } },
      data: { stock: { decrement: l.qty } },
    });
    if (r.count === 0) {
      const now = await tx.product.findUnique({ where: { id: l.product.id }, select: { stock: true } });
      throw new StockConflict([{ productId: l.product.id, name: l.product.name, available: Math.max(0, now?.stock ?? 0) }]);
    }
    stock.push({ productId: l.product.id, slug: l.product.slug, stockBefore: l.product.stock, stockAfter: l.product.stock - l.qty });
  }
  for (const id of giftIds) {
    const r = await tx.giftItem.updateMany({ where: { id, isActive: true, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } });
    if (r.count === 0) throw err.unprocessable(`${giftById.get(id)?.miniName ?? "A gift"} just ran out — please pick another free gift`, { step: "gifts", giftId: id });
  }
  if (rule) {
    const r = await tx.coupon.updateMany({
      where: { id: rule.id, isActive: true, ...(rule.usageLimit != null ? { usedCount: { lt: rule.usageLimit } } : {}) },
      data: { usedCount: { increment: 1 } },
    });
    if (r.count === 0) throw err.unprocessable(`${rule.code} has just been fully redeemed — remove it to continue`, { step: "coupon" });
  }

  // 7) order number (TBByymmdd####; retried on the rare collision)
  let number = "";
  for (let i = 0; i < 12 && !number; i++) {
    const n = orderNumber();
    if (!(await tx.order.findUnique({ where: { number: n }, select: { id: true } }))) number = n;
  }
  if (!number) number = `${orderNumber()}${Math.floor(Math.random() * 90 + 10)}`;

  const provider = method === "COD" ? "COD" : gatewayMode() === "RAZORPAY" ? "RAZORPAY" : "TEST";
  const order = await tx.order.create({
    data: {
      number,
      userId,
      status: "PENDING_PAYMENT",
      paymentMethod: provider,
      paymentStatus: provider === "COD" ? "COD_PENDING" : "PENDING",
      mrpTotal,
      subtotal,
      discount,
      shippingFee,
      codFee,
      total,
      couponCode: rule?.code ?? null,
      shipName: address.name,
      shipPhone: address.phone,
      shipLine1: address.line1,
      shipLine2: address.line2,
      shipLandmark: address.landmark,
      shipCity: address.city,
      shipState: address.state,
      shipPincode: address.pincode,
      notes: args.notes || null,
      items: {
        create: lines.map((l) => ({
          productId: l.product.id,
          sellerId: l.product.sellerId,
          name: l.product.name,
          brandName: l.product.brand.name,
          size: l.product.size,
          imageUrl: l.product.images[0]?.url ?? null,
          mrp: Math.max(l.product.mrp, l.product.price),
          price: l.product.price,
          qty: l.qty,
          lineTotal: l.lineTotal,
          commissionPct: l.commissionPct,
          commissionAmt: l.commissionAmt,
          sellerEarning: l.sellerEarning,
        })),
      },
      gifts: { create: giftIds.map((id) => ({ giftItemId: id, name: giftById.get(id)!.miniName, miniSize: giftById.get(id)!.miniSize, worth: giftById.get(id)!.worth })) },
      payments: {
        create: {
          purpose: "ORDER",
          provider,
          amount: total,
          status: provider === "COD" ? "COD_PENDING" : "PENDING",
          raw: { idempotencyKey: key, method },
        },
      },
    },
    select: { id: true, payments: { select: { id: true } } },
  });
  if (rule) await tx.couponUse.create({ data: { couponId: rule.id, userId, orderId: order.id, discount } });

  const payment = await tx.payment.findUniqueOrThrow({ where: { id: order.payments[0].id }, select: paymentSelect });
  return { reused: false, payment, stock };
}

function isNumberCollision(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && JSON.stringify(e.meta ?? {}).includes("number");
}

export async function placeOrder(user: AuthUser, input: PlaceOrderInput): Promise<PlaceResult> {
  const userId = user.id;

  const existing = await findAttempt(userId, input.idempotencyKey);
  if (existing) {
    if (existing.order?.status === "CANCELLED") {
      throw err.conflict("That checkout attempt has ended — please place your order again", { code: "ATTEMPT_ENDED" });
    }
    return paymentResult(existing, user, true);
  }

  const address = await db.address.findFirst({ where: { id: input.addressId, userId } });
  if (!address) throw err.unprocessable("Choose a delivery address for this order", { step: "address" });

  await cancelSupersededAttempts(userId, input.idempotencyKey);

  let created: Created | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await db.$transaction((tx) => createOrderTx(tx, { userId, key: input.idempotencyKey, method: input.method, notes: input.notes, address }), {
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (e) {
      if (e instanceof StockConflict) {
        await adjustCartForStock(userId, e.items);
        throw err.conflict(stockMessage(e.items), { step: "cart", items: e.items });
      }
      if (isNumberCollision(e) && attempt < 2) continue;
      throw e;
    }
  }
  if (!created) throw err.conflict("Couldn't place the order — please try again");

  const pay = created.payment;
  const order = pay.order!;
  if (created.reused) return paymentResult(pay, user, true);

  invalidateStock(created.stock, true);

  if (pay.provider === "COD") {
    await markOrderPlaced(order.id, "customer");
    await clearOrderedFromCart(order.id);
    const fresh = await db.payment.findUniqueOrThrow({ where: { id: pay.id }, select: paymentSelect });
    return paymentResult(fresh, user, false);
  }

  // online: open a gateway order for the amount we computed
  try {
    const gw = await createGatewayOrder(order.total, order.number, { orderId: order.id, userId });
    const updated = await db.payment.update({ where: { id: pay.id }, data: { providerOrderId: gw.providerOrderId }, select: paymentSelect });
    return paymentResult(updated, user, false);
  } catch (e) {
    console.error("[checkout] gateway order failed", order.number, e);
    await db.payment.updateMany({ where: { id: pay.id, status: "PENDING" }, data: { status: "FAILED" } });
    await cancelOrder(order.id, "system", "Payment gateway unavailable").catch(() => {});
    throw new ApiError(502, "GATEWAY_ERROR", "Our payment partner didn't respond — nothing was charged. Please try again or choose Cash on Delivery.");
  }
}
