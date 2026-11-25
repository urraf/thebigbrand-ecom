import { parseBody, route } from "@/lib/api";
import { replaceTiers, TiersBody } from "@/server/admin/core/gifts";
import { db } from "@/lib/db";

/** GET /api/v1/admin/gifts/tiers → active tier rules (ascending). */
export const GET = route({ auth: "admin" }, async () => ({
  tiers: await db.giftTier.findMany({ where: { isActive: true }, orderBy: { minAmount: "asc" }, select: { id: true, minAmount: true, giftCount: true } }),
}));

/**
 * PUT /api/v1/admin/gifts/tiers { tiers: [{ minAmount, giftCount }] } — replaces all rules. First tier starts at ₹0, thresholds
 * and gift counts strictly increase, 1–5 gifts, top tier ≤ number of active gifts. Live at checkout immediately.
 */
export const PUT = route({ auth: "admin" }, async ({ req, auth }) => replaceTiers(await parseBody(req, TiersBody), auth!.user.id));
