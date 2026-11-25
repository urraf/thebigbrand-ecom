import { z } from "zod";
import { err, parseBody, rateLimit, route } from "@/lib/api";
import { addressPatchSchema } from "@/server/account/schemas";
import { deleteAddress, getAddress, updateAddress } from "@/server/account/addresses";

const Params = z.object({ id: z.string().trim().min(1).max(64) });

/**
 * GET    /api/v1/account/addresses/:id                         → AddressView
 * PATCH  /api/v1/account/addresses/:id { any address field, isDefault: true } → AddressView
 * DELETE /api/v1/account/addresses/:id                         → { ok, defaultId } (the next address becomes default)
 * Only the owner's addresses are reachable (404 otherwise).
 */
export const GET = route<{ id: string }>({ auth: "user" }, async ({ params, auth }) => {
  const { id } = Params.parse(params);
  const a = await getAddress(auth!.user.id, id);
  if (!a) throw err.notFound("Address not found");
  return a;
});

export const PATCH = route<{ id: string }>({ auth: "user" }, async ({ req, params, auth }) => {
  rateLimit(`address:${auth!.user.id}`, 30, 60_000);
  const { id } = Params.parse(params);
  const patch = await parseBody(req, addressPatchSchema);
  return updateAddress(auth!.user.id, id, patch);
});

export const DELETE = route<{ id: string }>({ auth: "user" }, async ({ params, auth }) => {
  const { id } = Params.parse(params);
  return deleteAddress(auth!.user.id, id);
});
