import { route } from "@/lib/api";
import { getCheckoutSummary } from "@/server/checkout/summary";

/**
 * GET /api/v1/checkout/summary  (signed in)
 * → { cart, quote, gifts, tiers, addresses, payment: { mode: "RAZORPAY"|"TEST", keyId, codEnabled, codFee }, user }
 * Everything the 3-step checkout needs. All totals are server-computed (quote); never send totals back.
 */
export const GET = route({ auth: "user" }, async ({ auth }) => {
  const summary = await getCheckoutSummary(auth!.user);
  return Response.json({ data: summary }, { headers: { "cache-control": "private, no-store" } });
});
