import { z } from "zod";
import { clientIp } from "@/lib/auth";
import { parseBody, rateLimit, route } from "@/lib/api";
import { cartResponse, resolveCartOwner } from "@/server/cart/owner";
import { getCartView } from "@/server/cart/service";
import { getCartQuote } from "@/server/checkout/quote";
import { applyCouponToCart, removeCouponFromCart } from "@/server/coupons/service";

/**
 * POST   /api/v1/coupons/apply { code } → { cart, quote }   attach a coupon to the cart (guest or signed in)
 * DELETE /api/v1/coupons/apply          → { cart, quote }   remove it (same as POST /api/v1/coupons/remove)
 * Validated on the server: active, start/end dates, minimum order, brand scope, total usage and per-user limits
 * (per-user is checked once signed in, and again when the order is placed). 422 with the reason otherwise.
 */
const Body = z.object({ code: z.string().trim().min(2, "Enter a coupon code").max(40) });

export const POST = route({ auth: "public" }, async ({ req, auth }) => {
  rateLimit(`coupon:${auth?.user.id ?? clientIp(req) ?? "anon"}`, 30, 60_000);
  const { code } = await parseBody(req, Body);
  const owner = await resolveCartOwner(req, auth);
  await applyCouponToCart(await getCartView(owner), code, owner.userId);
  return cartResponse(await getCartQuote(owner), owner);
});

export const DELETE = route({ auth: "public" }, async ({ req, auth }) => {
  const owner = await resolveCartOwner(req, auth);
  await removeCouponFromCart(await getCartView(owner));
  return cartResponse(await getCartQuote(owner), owner);
});
