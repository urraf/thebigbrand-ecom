import { parseBody, rateLimit, route } from "@/lib/api";
import { placeOrder, placeOrderSchema } from "@/server/checkout/place-order";

/**
 * POST /api/v1/checkout/place  (signed in)
 * Body: { addressId, method: "UPI"|"CARD"|"NETBANKING"|"COD", idempotencyKey, notes? }
 * Places the signed-in user's cart (prices, stock, gifts, coupon, delivery and COD fee all recomputed from the
 * DB in one transaction). → PlaceResult:
 *   { order: { id, number, total, status }, payment: { id, provider: "COD"|"TEST"|"RAZORPAY", amount,
 *     razorpay: { keyId, orderId, amountPaise, currency, name, description, prefill } | null },
 *     redirect: "/order/<number>" | "/pay/test/<paymentId>" | null, reused }
 * COD orders are placed immediately. TEST → open `redirect`. RAZORPAY → open Checkout.js with `razorpay`, then
 * POST /api/v1/payments/razorpay/verify. Re-sending the same idempotencyKey returns the same order (reused: true).
 * Errors: 409 when stock changed (cart is adjusted, details.items), 422 for gift / coupon / address issues
 * (details.step tells the client which checkout step to reopen), 502 GATEWAY_ERROR.
 */
export const POST = route({ auth: "user" }, async ({ req, auth }) => {
  rateLimit(`place:${auth!.user.id}`, 12, 60_000);
  const input = await parseBody(req, placeOrderSchema);
  return placeOrder(auth!.user, input);
});
