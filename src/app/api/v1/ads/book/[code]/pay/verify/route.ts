import { parseBody, rateLimit, route } from "@/lib/api";
import { verifyBookingPayment, verifySchema } from "@/server/ads/booking";

/**
 * POST /api/v1/ads/book/[code]/pay/verify  (signed in, booker only)
 *   Razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature }  (signature verified server-side)
 *   TEST gateway (no Razorpay keys, non-production): { test: true, outcome: "success" | "failure" }
 *   → BookingView with paymentStatus PAID (422 when the payment failed / couldn't be verified)
 */
export const POST = route<{ code: string }>({ auth: "user" }, async ({ req, params, auth }) => {
  rateLimit(`adverify:${auth!.user.id}`, 20, 10 * 60_000);
  const body = await parseBody(req, verifySchema);
  return verifyBookingPayment(auth!, params.code, body);
});
