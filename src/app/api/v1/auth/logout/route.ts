import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { clearSessionCookieOn, requestScope, revokeSession } from "@/lib/auth";

/**
 * POST /api/v1/auth/logout — sign out of ONE area: the store by default, or the seller portal / admin console
 * when the request carries `x-tbb-scope: seller|admin`. Revokes that session and clears that cookie only.
 */
export const POST = route({ auth: "public" }, async ({ req, auth }) => {
  if (auth) await revokeSession(auth.sessionId);
  return clearSessionCookieOn(NextResponse.json({ data: { ok: true } }), requestScope(req));
});
