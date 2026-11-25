import { clientIp } from "@/lib/auth";
import { err, rateLimit, route } from "@/lib/api";
import { clipCoupon, unclipCoupon } from "@/server/ads/coupons";
import { viewerKey } from "@/server/ads/tracking";

/**
 * POST   /api/v1/ads/coupons/[id]/clip  (signed in) → { couponId, clipped: true, clipCount }
 *        Records a CouponClip (applied automatically at checkout) and bills the brand's CLIP-priced H9 campaign.
 * DELETE /api/v1/ads/coupons/[id]/clip  (signed in) → { couponId, clipped: false, clipCount }
 */
export const POST = route<{ id: string }>({ auth: "user" }, async ({ req, params, auth }) => {
  rateLimit(`clip:${auth!.user.id}`, 60, 60_000);
  const res = await clipCoupon(auth!.user.id, params.id, viewerKey(clientIp(req), req.headers.get("user-agent")));
  if (!res) throw err.notFound("This coupon has expired");
  return res;
});

export const DELETE = route<{ id: string }>({ auth: "user" }, async ({ params, auth }) => {
  rateLimit(`clip:${auth!.user.id}`, 60, 60_000);
  const res = await unclipCoupon(auth!.user.id, params.id);
  if (!res) throw err.notFound("Coupon not found");
  return res;
});
