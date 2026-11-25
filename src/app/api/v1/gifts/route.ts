import { route } from "@/lib/api";
import { getGiftCatalog } from "@/server/gifts/service";

/**
 * GET /api/v1/gifts  (public)
 * → { gifts: GiftOption[] (active TBB Originals minis: id, miniName, miniSize, worth, stock, product card),
 *     tiers: [{ minAmount, giftCount }], maxGifts, topWorth }
 * Choose gifts for the cart with PUT /api/v1/cart/gifts { giftIds } (validated against the allowance).
 */
export const GET = route({ auth: "public" }, async () => getGiftCatalog());
