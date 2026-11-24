import { z } from "zod";
import { db } from "@/lib/db";
import { err, parseBody, rateLimit, route } from "@/lib/api";
import { normalizePhone } from "@/lib/sms";
import { checkOtp } from "@/server/auth/otp";
import { signedInResponse } from "@/server/auth/session-response";

const Body = z.object({
  phone: z.string().min(10).max(16),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  name: z.string().trim().min(1).max(80).optional(),
});

/** POST /api/v1/auth/otp/verify — verify OTP, create the customer account if new, start a session. */
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, Body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw err.badRequest("Enter a valid 10-digit mobile number");
  rateLimit(`otp-verify:${phone}`, 10, 10 * 60 * 1000);

  const result = await checkOtp(phone, body.code);
  if (result === "invalid") throw err.badRequest("That code is incorrect");
  if (result === "expired") throw err.badRequest("The code has expired — request a new one");
  if (result === "locked") throw err.tooMany("Too many attempts — request a new code");

  let user = await db.user.findUnique({ where: { phone } });
  const isNew = !user;
  if (!user) user = await db.user.create({ data: { phone, name: body.name ?? null, role: "CUSTOMER" } });
  else if (body.name && !user.name) user = await db.user.update({ where: { id: user.id }, data: { name: body.name } });
  if (!user.isActive) throw err.forbidden("This account is disabled");

  return signedInResponse(req, user, { isNew });
});
