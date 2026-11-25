import { rateLimit, route } from "@/lib/api";
import { retryBookingPayment } from "@/server/ads/booking";

/**
 * POST /api/v1/ads/book/[code]/pay  (signed in, booker only) → BookingView with a fresh pending gateway order
 * (use after a failed or abandoned payment).
 */
export const POST = route<{ code: string }>({ auth: "user" }, async ({ params, auth }) => {
  rateLimit(`adpay:${auth!.user.id}`, 10, 10 * 60_000);
  return retryBookingPayment(auth!, params.code);
});
