import { z } from "zod";
import { clientIp } from "@/lib/auth";
import { parseBody, rateLimit, route } from "@/lib/api";
import { cartResponse, resolveCartOwner } from "@/server/cart/owner";
import { setGiftIds } from "@/server/cart/service";

/**
 * PUT /api/v1/cart/gifts { giftIds: string[] } → CartView
 * Chooses the free TBB gifts before payment. Validated against active, in-stock GiftItems and the
 * allowance unlocked by the cart subtotal (GiftTier) — 422 when over the allowance or a gift is unavailable.
 */
const Body = z.object({ giftIds: z.array(z.string().trim().min(1).max(64)).max(10) });

export const PUT = route({ auth: "public" }, async ({ req, auth }) => {
  rateLimit(`cart:${auth?.user.id ?? clientIp(req) ?? "anon"}`, 120, 60_000);
  const { giftIds } = await parseBody(req, Body);
  const owner = await resolveCartOwner(req, auth);
  return cartResponse(await setGiftIds(owner, giftIds), owner);
});
