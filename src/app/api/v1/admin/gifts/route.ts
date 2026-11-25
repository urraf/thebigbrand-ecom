import { parseBody, route } from "@/lib/api";
import { createGift, GiftCreate, getGiftsAdmin } from "@/server/admin/core/gifts";

/**
 * GET  /api/v1/admin/gifts → { items (minis + stock + pick share + gift→full-size conversion), tiers, ownProducts, funnel }
 * POST /api/v1/admin/gifts { productId (TBB Original), miniName, miniSize, worth, stock, isActive?, sortOrder? }
 * Changes apply to checkout immediately (cache tag "gifts").
 */
export const GET = route({ auth: "admin" }, async () => getGiftsAdmin());

export const POST = route({ auth: "admin" }, async ({ req, auth }) => createGift(await parseBody(req, GiftCreate), auth!.user.id));
