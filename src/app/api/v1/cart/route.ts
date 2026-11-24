import { z } from "zod";
import { clientIp } from "@/lib/auth";
import { parseBody, rateLimit, route } from "@/lib/api";
import { cartResponse, resolveCartOwner } from "@/server/cart/owner";
import { addItem, getCartView, MAX_QTY } from "@/server/cart/service";

/**
 * GET  /api/v1/cart                      → CartView (guest via `tbb_cart` cookie or `X-Cart-Token`, or the signed-in user's cart)
 * POST /api/v1/cart  { productId, qty? } → CartView after adding (qty 1–10, stock-checked; 409 when no more can be added)
 * A new guest cart sets the httpOnly `tbb_cart` cookie and returns the token in the `X-Cart-Token` header.
 */
export const GET = route({ auth: "public" }, async ({ req, auth }) => {
  const owner = await resolveCartOwner(req, auth);
  return cartResponse(await getCartView(owner), owner);
});

const AddBody = z.object({
  productId: z.string().trim().min(1).max(64),
  qty: z.coerce.number().int().min(1).max(MAX_QTY).default(1),
});

export const POST = route({ auth: "public" }, async ({ req, auth }) => {
  rateLimit(`cart:${auth?.user.id ?? clientIp(req) ?? "anon"}`, 120, 60_000);
  const { productId, qty } = await parseBody(req, AddBody);
  const owner = await resolveCartOwner(req, auth);
  return cartResponse(await addItem(owner, productId, qty), owner);
});
