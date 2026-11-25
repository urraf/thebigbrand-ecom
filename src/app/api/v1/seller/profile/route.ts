import { parseBody, rateLimit, route } from "@/lib/api";
import { toProfile, updateSellerProfile } from "@/server/seller/profile";
import { ProfileSchema } from "@/server/seller/schemas";

/** GET /api/v1/seller/profile — business profile (bank account number masked). */
export const GET = route({ auth: "seller" }, async ({ seller }) => toProfile(seller!));

/**
 * PATCH /api/v1/seller/profile — update contact, address, store details, logo, categories and bank.
 * Bank changes need { currentPassword } and are audited. Legal fields, status and commission are not editable.
 */
export const PATCH = route({ auth: "seller" }, async ({ req, auth, seller }) => {
  rateLimit(`seller-profile:${seller!.id}`, 30, 60 * 60 * 1000);
  const input = await parseBody(req, ProfileSchema);
  return updateSellerProfile(seller!, auth!.user.id, input);
});
