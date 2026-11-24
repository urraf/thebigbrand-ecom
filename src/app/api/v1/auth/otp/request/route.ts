import { z } from "zod";
import { err, parseBody, rateLimit, route } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { normalizePhone } from "@/lib/sms";
import { issueOtp } from "@/server/auth/otp";

const Body = z.object({ phone: z.string().min(10).max(16) });

/** POST /api/v1/auth/otp/request — send a 6-digit login OTP to an Indian mobile number. */
export const POST = route({ auth: "public" }, async ({ req }) => {
  const { phone: raw } = await parseBody(req, Body);
  const phone = normalizePhone(raw);
  if (!phone) throw err.badRequest("Enter a valid 10-digit mobile number");
  rateLimit(`otp:phone:${phone}`, 5, 10 * 60 * 1000);
  rateLimit(`otp:ip:${clientIp(req) ?? "unknown"}`, 20, 60 * 60 * 1000);
  const out = await issueOtp(phone);
  return { sent: true, phone, ...out };
});
