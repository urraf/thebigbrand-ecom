import { err, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { CouponPatch, deleteCoupon, updateCoupon } from "@/server/admin/core/coupons";

/** GET /api/v1/admin/coupons/:id */
export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  const c = await db.coupon.findUnique({ where: { id: params.id }, include: { brand: { select: { id: true, name: true, slug: true } }, _count: { select: { uses: true, clips: true } } } });
  if (!c) throw err.notFound("Coupon not found");
  return c;
});

/** PATCH /api/v1/admin/coupons/:id — any coupon fields ({ isActive: false } switches it off everywhere). */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => updateCoupon(params.id, await parseBody(req, CouponPatch), auth!.user.id));

/** DELETE /api/v1/admin/coupons/:id — only coupons never used on an order. */
export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, auth }) => deleteCoupon(params.id, auth!.user.id));
