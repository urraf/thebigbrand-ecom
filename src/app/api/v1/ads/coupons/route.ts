import { route } from "@/lib/api";
import { getClippedCouponIds, getCouponWall } from "@/server/ads/coupons";

/**
 * GET /api/v1/ads/coupons → { coupons: WallCoupon[], clipped: string[] | null }
 * The brand coupon wall (slot H9). `clipped` lists the signed-in shopper's clipped coupon ids (null when signed out).
 */
export const GET = route({ auth: "public" }, async ({ auth }) => {
  const [coupons, clipped] = await Promise.all([getCouponWall(24), auth ? getClippedCouponIds(auth.user.id) : Promise.resolve(null)]);
  return { coupons, clipped };
});
