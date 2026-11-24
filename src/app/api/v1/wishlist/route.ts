import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, rateLimit, route } from "@/lib/api";
import { addToWishlist, getWishlist } from "@/server/cart/wishlist";

/**
 * GET  /api/v1/wishlist              → { ids: string[], items: ProductCardData[] }   (signed-in only)
 * POST /api/v1/wishlist { productId } → { ids }                                       (idempotent)
 */
export const GET = route({ auth: "user" }, async ({ auth }) => {
  const data = await getWishlist(auth!.user.id);
  return NextResponse.json({ data }, { headers: { "cache-control": "private, no-store" } });
});

const Body = z.object({ productId: z.string().trim().min(1).max(64) });

export const POST = route({ auth: "user" }, async ({ req, auth }) => {
  rateLimit(`wish:${auth!.user.id}`, 90, 60_000);
  const { productId } = await parseBody(req, Body);
  return { ids: await addToWishlist(auth!.user.id, productId) };
});
