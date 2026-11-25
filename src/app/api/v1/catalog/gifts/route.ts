import { route } from "@/lib/api";
import { getGiftProgramme } from "@/server/catalog/offers";

/**
 * GET /api/v1/catalog/gifts — the Free Gift Store: { tiers: [{minAmount, giftCount}], gifts: [{ id, miniName,
 *   miniSize, worth, stock, product: ProductCard (the full-size TBB Original) }], maxGifts, worthUpTo }
 */
export const GET = route({ auth: "public" }, async () => getGiftProgramme());
