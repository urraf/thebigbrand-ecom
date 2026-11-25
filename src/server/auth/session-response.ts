import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/db";
import { clientIp, createSession, setSessionCookieOn, type AuthScope } from "@/lib/auth";
import { COOKIES } from "@/lib/site";
import { mergeGuestCart } from "@/server/cart/merge";

/**
 * Create a session for `user` in one area (store / seller portal / admin console), set that area's cookie and
 * return `{ data: { user, token } }`. Store sign-ins also merge the guest cart. Other areas' sign-ins are untouched.
 */
export async function signedInResponse(
  req: NextRequest,
  user: { id: string; role: Role; name: string | null; email: string | null; phone: string | null },
  extra: Record<string, unknown> = {},
  scope: AuthScope = "store",
) {
  const { token, expiresAt } = await createSession(user, { userAgent: req.headers.get("user-agent"), ip: clientIp(req) });
  const res = NextResponse.json({
    data: { user: { id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone }, token, expiresAt, scope, ...extra },
  });
  if (scope === "store") {
    await mergeGuestCart(user.id, req.cookies.get(COOKIES.cart)?.value).catch((e) => console.error("[auth] cart merge failed", e));
    res.cookies.set(COOKIES.cart, "", { maxAge: 0, path: "/" }); // guest cart has been merged into the user cart
  }
  return setSessionCookieOn(res, token, scope);
}
