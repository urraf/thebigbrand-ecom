import { z } from "zod";
import { clientIp } from "@/lib/auth";
import { parseBody, rateLimit, route } from "@/lib/api";
import { cartResponse, resolveCartOwner } from "@/server/cart/owner";
import { MAX_QTY, removeItem, setQty, setSavedForLater } from "@/server/cart/service";

/**
 * PATCH  /api/v1/cart/items/:productId  { qty?: 0–10, savedForLater?: boolean } → CartView
 * DELETE /api/v1/cart/items/:productId                                        → CartView
 * The whole body is validated before anything is written (no half-applied PATCH).
 */
const PatchBody = z
  .object({
    qty: z.coerce.number().int().min(0).max(MAX_QTY).optional(),
    savedForLater: z.boolean().optional(),
  })
  .refine((b) => b.qty !== undefined || b.savedForLater !== undefined, { message: "Send qty and/or savedForLater" })
  .refine((b) => !(b.savedForLater === true && b.qty !== undefined && b.qty > 0), {
    message: "Saved items have no quantity — move the item to your cart first",
    path: ["qty"],
  });

const Params = z.object({ productId: z.string().trim().min(1).max(64) });

const limit = (req: Parameters<typeof clientIp>[0], userId: string | undefined) =>
  rateLimit(`cart:${userId ?? clientIp(req) ?? "anon"}`, 120, 60_000);

export const PATCH = route<{ productId: string }>({ auth: "public" }, async ({ req, params, auth }) => {
  limit(req, auth?.user.id);
  const { productId } = Params.parse(params);
  const body = await parseBody(req, PatchBody);
  const owner = await resolveCartOwner(req, auth);
  let view;
  if (body.savedForLater !== undefined) view = await setSavedForLater(owner, productId, body.savedForLater);
  if (body.qty !== undefined) view = await setQty(owner, productId, body.qty);
  return cartResponse(view, owner);
});

export const DELETE = route<{ productId: string }>({ auth: "public" }, async ({ req, params, auth }) => {
  limit(req, auth?.user.id);
  const { productId } = Params.parse(params);
  const owner = await resolveCartOwner(req, auth);
  return cartResponse(await removeItem(owner, productId), owner);
});
