import { z } from "zod";
import { db } from "@/lib/db";
import { err, parseBody, rateLimit, route } from "@/lib/api";
import { clientIp, hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/sms";
import { signedInResponse } from "@/server/auth/session-response";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  phone: z.string().optional(),
});

/** POST /api/v1/auth/register — customer sign-up with email + password (OTP login is the default path). */
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, Body);
  rateLimit(`register-ip:${clientIp(req) ?? "unknown"}`, 10, 60 * 60 * 1000);
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (body.phone && !phone) throw err.badRequest("Enter a valid 10-digit mobile number");
  if (await db.user.findUnique({ where: { email: body.email } })) throw err.conflict("An account with this email already exists");
  if (phone && (await db.user.findUnique({ where: { phone } }))) throw err.conflict("An account with this mobile number already exists");
  const user = await db.user.create({
    data: { name: body.name, email: body.email, phone, passwordHash: await hashPassword(body.password), role: "CUSTOMER" },
  });
  return signedInResponse(req, user, { isNew: true });
});
