import { z } from "zod";
import { parseBody, rateLimit, route } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { requestPasswordReset } from "@/server/seller/password";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") });

/** POST /api/v1/seller/password/forgot { email } — sends a reset code to the seller's registered mobile. */
export const POST = route({ auth: "public" }, async ({ req }) => {
  const { email } = await parseBody(req, Body);
  rateLimit(`seller-forgot:${email}`, 4, 15 * 60 * 1000);
  rateLimit(`seller-forgot-ip:${clientIp(req) ?? "unknown"}`, 20, 60 * 60 * 1000);
  return requestPasswordReset(email);
});
