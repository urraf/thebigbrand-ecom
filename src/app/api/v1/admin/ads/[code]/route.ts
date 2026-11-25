import { err, parseBody, route } from "@/lib/api";
import { getSlotDetail, slotUpdateSchema, updateSlot } from "@/server/admin/growth/slots";

/**
 * GET   /api/v1/admin/ads/:code  (admin) → slot + its campaigns (with delivery state) + last-30-day daily stats
 * PATCH /api/v1/admin/ads/:code  (admin) { rate?, isActive?, positions?, bookable?, potentialMonthly?, description? }
 *       isActive=false pauses the slot everywhere immediately (ads cache invalidated). Rate applies to new bookings.
 */
export const GET = route<{ code: string }>({ auth: "admin" }, async ({ params }) => {
  const detail = await getSlotDetail(params.code.toUpperCase());
  if (!detail) throw err.notFound("Ad slot not found");
  return detail;
});

export const PATCH = route<{ code: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, slotUpdateSchema);
  return updateSlot(params.code.toUpperCase(), body, auth!.user.id);
});
