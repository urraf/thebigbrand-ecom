import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { clearSessionCookieOn, revokeSession } from "@/lib/auth";

/** POST /api/v1/auth/logout — revoke the current session and clear the cookie. */
export const POST = route({ auth: "public" }, async ({ auth }) => {
  if (auth) await revokeSession(auth.sessionId);
  return clearSessionCookieOn(NextResponse.json({ data: { ok: true } }));
});
