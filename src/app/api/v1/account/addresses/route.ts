import { parseBody, rateLimit, route } from "@/lib/api";
import { addressSchema } from "@/server/account/schemas";
import { createAddress, listAddresses } from "@/server/account/addresses";

/**
 * GET  /api/v1/account/addresses → AddressView[] (default first)
 * POST /api/v1/account/addresses { label?, name, phone, line1, line2?, landmark?, city, state, pincode, isDefault? }
 *      → AddressView (Indian 6-digit pincode, 10-digit mobile; the first address becomes the default)
 */
export const GET = route({ auth: "user" }, async ({ auth }) => listAddresses(auth!.user.id));

export const POST = route({ auth: "user" }, async ({ req, auth }) => {
  rateLimit(`address:${auth!.user.id}`, 30, 60_000);
  const data = await parseBody(req, addressSchema);
  return createAddress(auth!.user.id, data);
});
