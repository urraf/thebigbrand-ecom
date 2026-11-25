import { NextResponse } from "next/server";
import { parseBody, rateLimit, route } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { signedInResponse } from "@/server/auth/session-response";
import { submitApplication } from "@/server/seller/apply";
import { ApplySchema } from "@/server/seller/schemas";

/**
 * POST /api/v1/seller/apply — "Sell on The Big Brands" application.
 * Signed out: creates the account (role SELLER) + a PENDING seller and signs the user in (cookie + token).
 * Signed in: attaches/updates the application (resubmits a REJECTED one). Returns { seller: { id, slug, status } }.
 */
export const POST = route({ auth: "public" }, async ({ req, auth }) => {
  rateLimit(`seller-apply-ip:${clientIp(req) ?? "unknown"}`, 10, 60 * 60 * 1000);
  const input = await parseBody(req, ApplySchema);
  const out = await submitApplication(input, auth);
  const seller = { id: out.seller.id, slug: out.seller.slug, status: out.seller.status, displayName: out.seller.displayName };
  if (out.isNewUser) return signedInResponse(req, out.user, { seller, isNew: true }, "seller");
  return NextResponse.json({ data: { seller, resubmitted: out.resubmitted } }, { status: 200 });
});
