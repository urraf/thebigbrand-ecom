import { z } from "zod";
import { rateLimit, route } from "@/lib/api";
import { removeFromWishlist } from "@/server/cart/wishlist";

/** DELETE /api/v1/wishlist/:productId → { ids }  (signed-in only, idempotent) */
const Params = z.object({ productId: z.string().trim().min(1).max(64) });

export const DELETE = route<{ productId: string }>({ auth: "user" }, async ({ params, auth }) => {
  rateLimit(`wish:${auth!.user.id}`, 90, 60_000);
  const { productId } = Params.parse(params);
  return { ids: await removeFromWishlist(auth!.user.id, productId) };
});
