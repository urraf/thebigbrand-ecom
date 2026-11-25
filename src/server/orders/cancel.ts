import "server-only";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { invalidate, TAGS } from "@/lib/cache";
import { setOrderStatus, type Actor } from "@/server/orders/lifecycle";

/**
 * Order cancellation for the commerce flows (customer cancel, failed / abandoned online payments, the expiry
 * cron). Status changes go through the lifecycle (setOrderStatus restores product stock); on top of that a
 * fully cancelled order gives back what checkout reserved outside the lifecycle: free-gift stock and the
 * coupon use (CouponUse row + Coupon.usedCount). Idempotent — a marker on the order's first Payment.raw
 * stops a second restore — and serialised per order inside this server process.
 */

const locks = new Map<string, Promise<unknown>>();

/** Runs `fn` exclusively for one order (per server instance; the DB marker covers multi-instance races). */
export async function withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(orderId) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  const chain = prev.then(() => mine);
  locks.set(orderId, chain);
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(orderId) === chain) locks.delete(orderId);
  }
}

/** Busts product caches after stock moved. Listings (TAGS.products) only when a product crossed the low-stock / sold-out line. */
export function invalidateStock(items: { productId: string; slug: string | null; stockBefore: number; stockAfter: number }[], gifts = false) {
  const tags = new Set<string>();
  for (const i of items) {
    tags.add(TAGS.product(i.productId));
    if (i.slug) tags.add(TAGS.product(i.slug));
    const crossed = (i.stockBefore <= 5) !== (i.stockAfter <= 5) || (i.stockBefore <= 0) !== (i.stockAfter <= 0) || i.stockAfter <= 5;
    if (crossed) tags.add(TAGS.products);
  }
  if (gifts) tags.add(TAGS.gifts);
  try {
    invalidate(...tags);
  } catch (e) {
    // only possible outside a request scope (e.g. a script) — caches then expire by their own cacheLife
    console.warn("[orders] cache invalidation skipped", e instanceof Error ? e.message : e);
  }
}

/** Gives back gift stock and the coupon use of a CANCELLED order (once). Returns true when it restored something. */
export async function restoreCheckoutReservations(orderId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        gifts: { select: { giftItemId: true } },
        payments: { select: { id: true, raw: true }, orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    if (!order || order.status !== "CANCELLED") return false;
    const pay = order.payments[0];
    const raw = (pay?.raw && typeof pay.raw === "object" && !Array.isArray(pay.raw) ? pay.raw : {}) as Record<string, unknown>;
    if (raw.reservationsRestored) return false;

    const perGift = new Map<string, number>();
    for (const g of order.gifts) perGift.set(g.giftItemId, (perGift.get(g.giftItemId) ?? 0) + 1);
    for (const [id, n] of perGift) await tx.giftItem.update({ where: { id }, data: { stock: { increment: n } } });

    const uses = await tx.couponUse.findMany({ where: { orderId }, select: { couponId: true } });
    if (uses.length) {
      await tx.couponUse.deleteMany({ where: { orderId } });
      const perCoupon = new Map<string, number>();
      for (const u of uses) perCoupon.set(u.couponId, (perCoupon.get(u.couponId) ?? 0) + 1);
      for (const [id, n] of perCoupon) {
        await tx.coupon.updateMany({ where: { id, usedCount: { gte: n } }, data: { usedCount: { decrement: n } } });
      }
    }
    if (pay) await tx.payment.update({ where: { id: pay.id }, data: { raw: { ...raw, reservationsRestored: true } } });
    return perGift.size > 0 || uses.length > 0;
  });
}

const LIFECYCLE_ERRORS: Record<string, string> = {
  ORDER_NOT_PAID: "This order hasn't been paid yet",
};

/**
 * Cancels every cancellable item of an order (lifecycle), then restores gifts + coupon when the whole order
 * ended up CANCELLED. Returns the resulting order status.
 */
export async function cancelOrder(orderId: string, actor: Actor, note?: string): Promise<{ status: string; cancelled: boolean }> {
  return withOrderLock(orderId, async () => {
    const before = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true, items: { select: { productId: true, qty: true, status: true, product: { select: { slug: true, stock: true } } } } },
    });
    if (!before) throw err.notFound("Order not found");
    if (before.status === "CANCELLED") return { status: "CANCELLED", cancelled: false };

    let status: string;
    try {
      status = await setOrderStatus(orderId, "CANCELLED", actor, note);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      throw err.conflict(LIFECYCLE_ERRORS[code] ?? "This order can't be cancelled any more");
    }
    const cancelled = status === "CANCELLED";
    if (cancelled) await restoreCheckoutReservations(orderId);
    // an unpaid online order that ends here never got its money: mark the order's payment as failed
    if (cancelled && before.status === "PENDING_PAYMENT") {
      await db.order.updateMany({ where: { id: orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
    }

    const restocked = before.items.filter((i) => ["PLACED", "CONFIRMED", "PACKED"].includes(i.status));
    invalidateStock(
      restocked.map((i) => ({ productId: i.productId, slug: i.product.slug, stockBefore: i.product.stock, stockAfter: i.product.stock + i.qty })),
      cancelled,
    );
    return { status, cancelled };
  });
}

/** After a successful placement / payment: drop the ordered products, the used coupon and the gift picks from the cart (saved-for-later stays). */
export async function clearOrderedFromCart(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, couponCode: true, items: { select: { productId: true } } },
  });
  if (!order) return;
  const cart = await db.cart.findUnique({ where: { userId: order.userId }, select: { id: true, couponCode: true } });
  if (!cart) return;
  await db.$transaction([
    db.cartItem.deleteMany({ where: { cartId: cart.id, savedForLater: false, productId: { in: order.items.map((i) => i.productId) } } }),
    db.cart.update({
      where: { id: cart.id },
      data: {
        giftIds: [],
        ...(cart.couponCode && order.couponCode && cart.couponCode.toUpperCase() === order.couponCode.toUpperCase() ? { couponCode: null } : {}),
      },
    }),
  ]);
}
