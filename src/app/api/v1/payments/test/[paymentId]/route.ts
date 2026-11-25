import { z } from "zod";
import { err, parseBody, rateLimit, route } from "@/lib/api";
import { completeTestPayment, getTestPayment } from "@/server/payments/service";

const Params = z.object({ paymentId: z.string().trim().min(10).max(40) });
const Body = z.object({ outcome: z.enum(["success", "failure"]) });

/**
 * Built-in TEST gateway (only while no Razorpay keys are configured — 403 otherwise).
 * GET  /api/v1/payments/test/:paymentId                     → { id, amount, status, orderNumber, … } (owner only)
 * POST /api/v1/payments/test/:paymentId { outcome: "success"|"failure" } → { redirect, status }
 *   success → Payment PAID + order PLACED + cart cleared · failure → Payment FAILED + order cancelled (stock,
 *   gifts and coupon restored; the cart is untouched so the shopper can try again).
 */
export const GET = route<{ paymentId: string }>({ auth: "user" }, async ({ params, auth }) => {
  const { paymentId } = Params.parse(params);
  const p = await getTestPayment(auth!.user.id, paymentId);
  if (!p) throw err.notFound("Payment not found");
  return p;
});

export const POST = route<{ paymentId: string }>({ auth: "user" }, async ({ req, params, auth }) => {
  rateLimit(`pay-test:${auth!.user.id}`, 20, 60_000);
  const { paymentId } = Params.parse(params);
  const { outcome } = await parseBody(req, Body);
  return completeTestPayment(auth!.user.id, paymentId, outcome);
});
