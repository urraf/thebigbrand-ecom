import { z } from "zod";
import { err, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { isTimeBased, MIN_PERF_BUDGET, quoteBooking } from "@/components/ads/lib/pricing";
import { dateWindow } from "@/server/ads/booking";

/**
 * POST /api/v1/ads/quote { slotCode, startDate, endDate, budget? } → BookingQuote (same maths as booking:
 * flat slots = units × rate − volume discount; CPM/CPC = budget; + 18% GST). Public, for the apps' estimator.
 */
const Body = z.object({
  slotCode: z.string().trim().toUpperCase().regex(/^[A-Z]\d{1,2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget: z.coerce.number().int().min(0).max(5_000_000).optional().default(0),
});

export const POST = route({ auth: "public" }, async ({ req }) => {
  const b = await parseBody(req, Body);
  const slot = await db.adSlot.findUnique({ where: { code: b.slotCode }, select: { pricingModel: true, rate: true, name: true } });
  if (!slot) throw err.notFound("Unknown placement");
  const { days } = dateWindow(b.startDate, b.endDate);
  if (!isTimeBased(slot.pricingModel) && b.budget < MIN_PERF_BUDGET) throw err.badRequest(`Minimum budget is ₹${MIN_PERF_BUDGET}`);
  return quoteBooking(slot, days, b.budget);
});
