import { route } from "@/lib/api";
import { cartResponse, resolveCartOwner } from "@/server/cart/owner";
import { getCartQuote } from "@/server/checkout/quote";
import { listOffers } from "@/server/coupons/service";

/**
 * GET /api/v1/checkout/quote[?offers=1]  (guest or signed in — uses the cart cookie / X-Cart-Token)
 * → { cart, quote, offers? }  Server-computed totals for the cart page: M.R.P., savings, coupon (re-validated),
 * delivery, chosen gifts, total. `offers=1` adds the coupons that apply to this cart, best saving first.
 */
export const GET = route({ auth: "public" }, async ({ req, auth }) => {
  const owner = await resolveCartOwner(req, auth);
  const { cart, quote } = await getCartQuote(owner);
  const offers = req.nextUrl.searchParams.get("offers") === "1" ? await listOffers(cart, owner.userId) : undefined;
  return cartResponse({ cart, quote, ...(offers ? { offers } : {}) }, owner);
});
