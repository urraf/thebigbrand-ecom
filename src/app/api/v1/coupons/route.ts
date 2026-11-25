import { route } from "@/lib/api";
import { cartResponse, resolveCartOwner } from "@/server/cart/owner";
import { getCartView } from "@/server/cart/service";
import { listOffers } from "@/server/coupons/service";

/**
 * GET /api/v1/coupons  (guest or signed in)
 * → { offers: CouponOffer[] } — coupons for the current cart, best saving first: { code, title, description,
 * brandName, applicable, discount, message ("Save ₹120" / "Add ₹200 more…"), applied }.
 */
export const GET = route({ auth: "public" }, async ({ req, auth }) => {
  const owner = await resolveCartOwner(req, auth);
  const cart = await getCartView(owner);
  return cartResponse({ offers: await listOffers(cart, owner.userId, 12) }, owner);
});
