import { z } from "zod";
import { rateLimit, route } from "@/lib/api";
import { retryOrderPayment } from "@/server/payments/service";

const Params = z.object({ number: z.string().trim().min(6).max(24) });

/**
 * POST /api/v1/orders/:number/pay  (signed in, owner only) → PlaceResult
 * Re-opens payment for an unpaid online order (e.g. the Razorpay window was closed): Razorpay → the same
 * gateway order to open in Checkout.js; TEST → `redirect` to the test gateway page.
 */
export const POST = route<{ number: string }>({ auth: "user" }, async ({ params, auth }) => {
  rateLimit(`order-action:${auth!.user.id}`, 20, 60_000);
  const { number } = Params.parse(params);
  return retryOrderPayment(auth!.user, number);
});
