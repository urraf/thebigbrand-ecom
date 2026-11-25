import { route } from "@/lib/api";
import { handleRazorpayWebhook } from "@/server/payments/service";

/**
 * POST /api/v1/payments/razorpay/webhook  (called by Razorpay; no session)
 * Configure in the Razorpay dashboard → Webhooks with the secret in RAZORPAY_WEBHOOK_SECRET and the events
 * `payment.captured`, `order.paid` and `payment.failed`. The raw body is verified against the
 * `x-razorpay-signature` header (401 when invalid). Idempotent: repeats of an event never place an order twice.
 * → { handled, event, detail }
 */
export const POST = route({ auth: "public" }, async ({ req }) => {
  const raw = await req.text();
  return handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"));
});
