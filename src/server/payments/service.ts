import "server-only";
import { db, type Prisma } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import type { AuthUser } from "@/lib/auth";
import { toPaise } from "@/lib/money";
import { gatewayMode, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/payments";
import { markOrderPlaced } from "@/server/orders/lifecycle";
import { cancelOrder, clearOrderedFromCart } from "@/server/orders/cancel";
import { paymentResult } from "@/server/checkout/place-order";
import type { PlaceResult } from "@/server/checkout/types";

/**
 * PAYMENTS — confirmation of online order payments. An order is only marked paid from:
 *   · a verified Razorpay Checkout signature (POST /api/v1/payments/razorpay/verify),
 *   · a verified Razorpay webhook (POST /api/v1/payments/razorpay/webhook — payment.captured / order.paid),
 *   · the built-in TEST gateway, only while gatewayMode() === "TEST" (POST /api/v1/payments/test/:paymentId).
 * Every path is idempotent: the Payment row is claimed with a conditional update (PENDING|FAILED → PAID) so a
 * browser callback racing the webhook places the order exactly once. Abandoned online orders are cancelled
 * by the expiry cron (GET /api/v1/internal/cron/expire-orders) — that restores stock, gifts and the coupon.
 */

type JsonObj = Record<string, unknown>;
const asObj = (v: Prisma.JsonValue | null | undefined): JsonObj => (v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObj) : {});

const payWithOrder = {
  id: true,
  provider: true,
  amount: true,
  status: true,
  providerOrderId: true,
  raw: true,
  order: { select: { id: true, number: true, total: true, status: true, userId: true } },
} satisfies Prisma.PaymentSelect;

export type FinalizeResult = { orderNumber: string; refundDue: boolean; already: boolean };

/** Marks a payment PAID and the order PLACED (once), then clears the ordered items from the cart. */
export async function finalizePaidPayment(paymentId: string, data: { providerPaymentId?: string | null; signature?: string | null; raw?: JsonObj } = {}): Promise<FinalizeResult> {
  const pay = await db.payment.findUnique({ where: { id: paymentId }, select: payWithOrder });
  if (!pay?.order) throw err.notFound("Payment not found");
  const order = pay.order;
  const claimed = await db.payment.updateMany({
    where: { id: pay.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PAID",
      ...(data.providerPaymentId ? { providerPaymentId: data.providerPaymentId } : {}),
      ...(data.signature ? { signature: data.signature } : {}),
      raw: { ...asObj(pay.raw), ...(data.raw ?? {}), paidAt: new Date().toISOString() } as Prisma.InputJsonValue,
    },
  });
  if (claimed.count === 0) return { orderNumber: order.number, refundDue: order.status === "CANCELLED", already: true };

  if (order.status === "CANCELLED") {
    // money arrived after the order expired / was replaced — keep the record, flag it for a refund
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
    await db.orderEvent.create({
      data: { orderId: order.id, status: "CANCELLED", actor: "system", note: "Payment received after this order was cancelled — a full refund will be issued to the original payment method" },
    });
    await audit(null, "payment.captured_after_cancel", "Order", order.id, { number: order.number, amount: pay.amount, paymentId: pay.id });
    return { orderNumber: order.number, refundDue: true, already: false };
  }

  await markOrderPlaced(order.id, "system");
  await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
  await clearOrderedFromCart(order.id);
  return { orderNumber: order.number, refundDue: false, already: false };
}

/** Marks a pending payment FAILED; with `cancel` the unpaid order is cancelled too (stock, gifts, coupon restored). */
export async function failPayment(paymentId: string, reason: string, opts: { cancel: boolean; raw?: JsonObj }): Promise<{ orderNumber: string; cancelled: boolean }> {
  const pay = await db.payment.findUnique({ where: { id: paymentId }, select: payWithOrder });
  if (!pay?.order) throw err.notFound("Payment not found");
  const claimed = await db.payment.updateMany({
    where: { id: pay.id, status: "PENDING" },
    data: { status: "FAILED", raw: { ...asObj(pay.raw), ...(opts.raw ?? {}), failure: reason, failedAt: new Date().toISOString() } as Prisma.InputJsonValue },
  });
  let cancelled = false;
  if (opts.cancel && (claimed.count > 0 || pay.status === "FAILED") && pay.order.status === "PENDING_PAYMENT") {
    const r = await cancelOrder(pay.order.id, "system", `Payment failed — ${reason}`);
    cancelled = r.cancelled;
  }
  return { orderNumber: pay.order.number, cancelled };
}

// ───────────────────────────── Razorpay ─────────────────────────────

export async function verifyRazorpayPayment(
  userId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
): Promise<FinalizeResult> {
  const pay = await db.payment.findUnique({ where: { providerOrderId: body.razorpay_order_id }, select: payWithOrder });
  if (!pay?.order || pay.order.userId !== userId) throw err.notFound("Payment not found");
  if (pay.provider !== "RAZORPAY") throw err.badRequest("This payment isn't a Razorpay payment");
  if (!verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
    await audit(userId, "payment.signature_invalid", "Payment", pay.id, { orderId: body.razorpay_order_id });
    throw err.badRequest("We couldn't verify this payment. If money was debited it will be confirmed automatically or refunded.");
  }
  return finalizePaidPayment(pay.id, {
    providerPaymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
    raw: { verifiedVia: "checkout" },
  });
}

type RzpPaymentEntity = { id?: string; order_id?: string; amount?: number; status?: string; method?: string; error_description?: string; error_reason?: string };

/** Razorpay webhook. Returns what happened (always 200 for events we don't act on, so Razorpay doesn't retry them). */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null): Promise<{ handled: boolean; event: string; detail?: string }> {
  if (!verifyWebhookSignature(rawBody, signature)) throw err.unauthorized("Invalid webhook signature");
  let evt: { event?: string; payload?: { payment?: { entity?: RzpPaymentEntity }; order?: { entity?: { id?: string } } } };
  try {
    evt = JSON.parse(rawBody);
  } catch {
    throw err.badRequest("Invalid JSON");
  }
  const event = String(evt.event ?? "");
  const entity = evt.payload?.payment?.entity ?? {};
  const providerOrderId = entity.order_id ?? evt.payload?.order?.entity?.id ?? null;
  if (!providerOrderId) return { handled: false, event, detail: "no order id" };

  const pay = await db.payment.findUnique({ where: { providerOrderId }, select: payWithOrder });
  if (!pay?.order) return { handled: false, event, detail: "unknown order" };

  if (event === "payment.captured" || event === "order.paid") {
    if (typeof entity.amount === "number" && entity.amount !== toPaise(pay.amount)) {
      await audit(null, "payment.amount_mismatch", "Payment", pay.id, { expected: toPaise(pay.amount), got: entity.amount, event });
      return { handled: false, event, detail: "amount mismatch" };
    }
    const r = await finalizePaidPayment(pay.id, { providerPaymentId: entity.id ?? null, raw: { verifiedVia: "webhook", webhookEvent: event, method: entity.method ?? null } });
    return { handled: true, event, detail: r.already ? "already paid" : r.refundDue ? "refund due" : "placed" };
  }
  if (event === "payment.failed") {
    // the shopper may retry inside the same Razorpay order — leave the order open; the expiry cron cancels it if they don't
    await db.payment.updateMany({
      where: { id: pay.id, status: "PENDING" },
      data: { status: "FAILED", raw: { ...asObj(pay.raw), failure: entity.error_description ?? entity.error_reason ?? "failed", failedAt: new Date().toISOString() } as Prisma.InputJsonValue },
    });
    return { handled: true, event, detail: "marked failed" };
  }
  return { handled: false, event };
}

// ───────────────────────────── TEST gateway ─────────────────────────────

export type TestPaymentView = {
  id: string;
  amount: number;
  status: string;
  orderNumber: string;
  orderStatus: string;
  itemCount: number;
  giftCount: number;
  method: string | null;
  createdAt: string;
};

/** The TEST gateway page data (owner only, TEST mode only). */
export async function getTestPayment(userId: string, paymentId: string): Promise<TestPaymentView | null> {
  const pay = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      provider: true,
      amount: true,
      status: true,
      raw: true,
      createdAt: true,
      order: { select: { number: true, status: true, userId: true, _count: { select: { items: true, gifts: true } } } },
    },
  });
  if (!pay?.order || pay.order.userId !== userId || pay.provider !== "TEST") return null;
  const method = asObj(pay.raw).method;
  return {
    id: pay.id,
    amount: pay.amount,
    status: pay.status,
    orderNumber: pay.order.number,
    orderStatus: pay.order.status,
    itemCount: pay.order._count.items,
    giftCount: pay.order._count.gifts,
    method: typeof method === "string" ? method : null,
    createdAt: pay.createdAt.toISOString(),
  };
}

export async function completeTestPayment(userId: string, paymentId: string, outcome: "success" | "failure"): Promise<{ redirect: string; status: string }> {
  if (gatewayMode() !== "TEST") throw err.forbidden("The test gateway is disabled because a live payment gateway is configured");
  const pay = await db.payment.findUnique({ where: { id: paymentId }, select: payWithOrder });
  if (!pay?.order || pay.order.userId !== userId || pay.provider !== "TEST") throw err.notFound("Payment not found");
  if (outcome === "success") {
    const r = await finalizePaidPayment(pay.id, { providerPaymentId: `test_pay_${Date.now().toString(36)}`, raw: { verifiedVia: "test-gateway" } });
    return { redirect: `/order/${r.orderNumber}`, status: r.refundDue ? "REFUND_DUE" : "PAID" };
  }
  if (pay.status === "PAID") return { redirect: `/order/${pay.order.number}`, status: "PAID" };
  const r = await failPayment(pay.id, "declined on the test gateway", { cancel: true });
  return { redirect: `/checkout?payment=failed&order=${encodeURIComponent(r.orderNumber)}`, status: "FAILED" };
}

// ───────────────────────────── retry & expiry ─────────────────────────────

/** Re-open payment for an unpaid online order (closed Razorpay window, back button on the test page…). */
export async function retryOrderPayment(user: AuthUser, number: string): Promise<PlaceResult> {
  const order = await db.order.findFirst({ where: { number, userId: user.id }, select: { id: true, status: true, paymentMethod: true } });
  if (!order) throw err.notFound("Order not found");
  if (order.status !== "PENDING_PAYMENT") throw err.conflict(order.status === "CANCELLED" ? "This order was cancelled — please place it again from your cart" : "This order is already paid");
  if (order.paymentMethod !== gatewayMode()) throw err.conflict("Payment options changed since this order was created — please place it again from your cart");
  const pay = await db.payment.findFirst({
    where: { orderId: order.id, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    select: payWithOrder,
  });
  if (!pay) throw err.conflict("This order can't be paid any more — please place it again");
  if (pay.provider === "TEST" && pay.status === "FAILED") throw err.conflict("This payment failed — please place the order again");
  return paymentResult(pay, user, true);
}

/** Cancels online orders still unpaid after `minutes` (default 30). Used by the cron route. */
export async function expireUnpaidOrders(minutes = 30, limit = 100): Promise<{ expired: string[]; skipped: string[] }> {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, number: true, payments: { select: { status: true } } },
  });
  const expired: string[] = [];
  const skipped: string[] = [];
  for (const o of stale) {
    if (o.payments.some((p) => p.status === "PAID")) {
      skipped.push(o.number); // paid but not yet placed — finalize will place it
      continue;
    }
    await db.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { status: "FAILED" } });
    try {
      const r = await cancelOrder(o.id, "system", `Payment not completed within ${minutes} minutes`);
      (r.cancelled ? expired : skipped).push(o.number);
    } catch (e) {
      console.error("[cron] expire failed", o.number, e);
      skipped.push(o.number);
    }
  }
  return { expired, skipped };
}
