import { parseBody, parseQuery, route } from "@/lib/api";
import { CouponCreate, CouponListQuery, couponStats, createCoupon, listCoupons } from "@/server/admin/core/coupons";

/**
 * GET  /api/v1/admin/coupons?q&status(=live|scheduled|expired|off|used_up)&type(=PERCENT|FLAT|BOGO)&kind(=sponsored|store)&page&limit → paged + stats
 * POST /api/v1/admin/coupons { code, title, description?, type, value, minOrder, maxDiscount?, brandId?, startsAt?, endsAt?,
 *      usageLimit?, perUserLimit, isActive, isSponsored }  — isSponsored = brand coupon wall (ad slot H9, billed per clip)
 */
export const GET = route({ auth: "admin" }, async ({ req }) => {
  const [list, stats] = await Promise.all([listCoupons(parseQuery(req, CouponListQuery)), couponStats()]);
  return { ...list, stats };
});

export const POST = route({ auth: "admin" }, async ({ req, auth }) => createCoupon(await parseBody(req, CouponCreate), auth!.user.id));
