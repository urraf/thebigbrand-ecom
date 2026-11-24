import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { COOKIES } from "@/lib/site";
import { mergeGuestCart } from "./merge";
import type { CartOwner } from "./service";

/** Guest cart cookie lifetime: 60 days. */
const GUEST_MAX_AGE = 60 * 24 * 60 * 60;
/** Mobile apps (no cookie jar) may send the guest token in this header instead. */
export const CART_TOKEN_HEADER = "x-cart-token";

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

export function guestTokenFrom(req: NextRequest): string | null {
  const t = req.cookies.get(COOKIES.cart)?.value || req.headers.get(CART_TOKEN_HEADER) || null;
  return t && TOKEN.test(t) ? t : null;
}

export type ResolvedOwner = CartOwner & { clearGuestCookie?: boolean };

/**
 * Cart owner for an API request. A signed-in request that still carries a guest cart token has that guest
 * cart merged into the user's cart first (and the cookie is cleared on the response).
 */
export async function resolveCartOwner(req: NextRequest, auth: AuthContext | null): Promise<ResolvedOwner> {
  const guestToken = guestTokenFrom(req);
  if (auth) {
    if (guestToken) {
      await mergeGuestCart(auth.user.id, guestToken);
      return { userId: auth.user.id, guestToken: null, clearGuestCookie: true };
    }
    return { userId: auth.user.id, guestToken: null };
  }
  return { userId: null, guestToken };
}

const cookieOpts = () => ({ httpOnly: true, sameSite: "lax" as const, secure: env.isProd, path: "/", maxAge: GUEST_MAX_AGE });

/** `{ data }` JSON response that also persists a newly issued guest token / clears a merged one. */
export function cartResponse(data: unknown, owner: ResolvedOwner, init?: ResponseInit) {
  const res = NextResponse.json({ data }, init);
  res.headers.set("cache-control", "private, no-store");
  if (owner.issuedToken) {
    res.cookies.set(COOKIES.cart, owner.issuedToken, cookieOpts());
    res.headers.set(CART_TOKEN_HEADER, owner.issuedToken);
  } else if (owner.clearGuestCookie) {
    res.cookies.set(COOKIES.cart, "", { ...cookieOpts(), maxAge: 0 });
  }
  return res;
}
