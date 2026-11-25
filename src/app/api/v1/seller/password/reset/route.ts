import { z } from "zod";
import { parseBody, rateLimit, route } from "@/lib/api";
import { signedInResponse } from "@/server/auth/session-response";
import { resetPassword } from "@/server/seller/password";
import { passwordField } from "@/server/seller/schemas";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: passwordField,
});

/** POST /api/v1/seller/password/reset { email, code, password } — sets a new password, signs out other devices, signs in. */
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, Body);
  rateLimit(`seller-reset:${body.email}`, 10, 15 * 60 * 1000);
  const user = await resetPassword(body.email, body.code, body.password);
  return signedInResponse(req, user, {});
});
