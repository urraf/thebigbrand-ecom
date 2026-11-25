import { parseBody, rateLimit, route } from "@/lib/api";
import { profileSchema } from "@/server/account/schemas";
import { getProfile, updateProfile } from "@/server/account/profile";

/**
 * GET   /api/v1/account/profile               → { id, name, email, phone, role, hasPassword, memberSince }
 * PATCH /api/v1/account/profile { name?, email? } → profile  (email "" removes it; 409 when another account uses it)
 * The mobile number is the OTP sign-in identity and can't be changed here.
 */
export const GET = route({ auth: "user" }, async ({ auth }) => getProfile(auth!.user.id));

export const PATCH = route({ auth: "user" }, async ({ req, auth }) => {
  rateLimit(`profile:${auth!.user.id}`, 20, 60_000);
  const body = await parseBody(req, profileSchema);
  return updateProfile(auth!.user.id, body);
});
