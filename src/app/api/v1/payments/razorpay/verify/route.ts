import { z } from "zod";
import { parseBody, rateLimit, route } from "@/lib/api";
import { verifyRazorpayPayment } from "@/server/payments/service";

const Body = z.object({
  razorpay_order_id: z.string().trim().min(6).max(64),
  razorpay_payment_id: z.string().trim().min(6).max(64),
  razorpay_signature: z.string().trim().min(16).max(256),
});

/**
 * POST /api/v1/payments/razorpay/verify  (signed in, owner only)
 * Body: the three fields Razorpay Checkout passes to its `handler`.
 * Verifies the HMAC signature → Payment PAID → order PLACED → ordered items leave the cart.
 * → { orderNumber, refundDue, already, redirect }. Idempotent (safe to call again / after the webhook).
 */
export const POST = route({ auth: "user" }, async ({ req, auth }) => {
  rateLimit(`pay-verify:${auth!.user.id}`, 20, 60_000);
  const body = await parseBody(req, Body);
  const r = await verifyRazorpayPayment(auth!.user.id, body);
  return { ...r, redirect: `/order/${r.orderNumber}` };
});
