import { route } from "@/lib/api";
import { cartResponse, resolveCartOwner } from "@/server/cart/owner";
import { getCartView } from "@/server/cart/service";
import { getCartQuote } from "@/server/checkout/quote";
import { removeCouponFromCart } from "@/server/coupons/service";

/** POST /api/v1/coupons/remove → { cart, quote } — removes the cart's coupon (guest or signed in). */
export const POST = route({ auth: "public" }, async ({ req, auth }) => {
  const owner = await resolveCartOwner(req, auth);
  await removeCouponFromCart(await getCartView(owner));
  return cartResponse(await getCartQuote(owner), owner);
});
