import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { otpCode } from "@/lib/ids";
import { sendOtpSms } from "@/lib/sms";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashOtp(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}:${env.authSecret}`).digest("hex");
}

/** Issue a login OTP. Returns the code only when OTP_DEV_MODE=true (demo/staging). */
export async function issueOtp(phone: string): Promise<{ devOtp?: string; expiresInSec: number }> {
  const code = otpCode();
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  await sendOtpSms(phone, code);
  return { ...(env.otpDevMode ? { devOtp: code } : {}), expiresInSec: OTP_TTL_MS / 1000 };
}

export type OtpCheck = "ok" | "invalid" | "expired" | "locked";

/** Verify the most recent unconsumed OTP for this phone. Consumes it on success. */
export async function checkOtp(phone: string, code: string): Promise<OtpCheck> {
  const rec = await db.otpCode.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!rec || rec.expiresAt < new Date()) return "expired";
  if (rec.attempts >= MAX_ATTEMPTS) return "locked";
  if (rec.codeHash !== hashOtp(phone, code)) {
    await db.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    return "invalid";
  }
  await db.otpCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });
  return "ok";
}
