import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getAccountOverview } from "@/server/account/overview";

/**
 * GET /api/v1/account/overview  (signed in)
 * → { profile, stats: { orders, active, giftsReceived, giftWorth, totalSaved }, recentOrders: OrderListItem[3],
 *     orderCounts, defaultAddress, wishlistCount } — the account home screen in one call.
 */
export const GET = route({ auth: "user" }, async ({ auth }) => {
  const data = await getAccountOverview(auth!.user.id);
  return NextResponse.json({ data }, { headers: { "cache-control": "private, no-store" } });
});
