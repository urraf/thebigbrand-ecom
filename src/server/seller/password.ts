import "server-only";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { checkOtp, issueOtp } from "@/server/auth/otp";

/**
 * Seller "forgot password": a 6-digit OTP goes to the account's registered mobile; the seller sets a new
 * password with it. The response never reveals whether an email is registered.
 */

async function sellerUserByEmail(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, phone: true, role: true, isActive: true, seller: { select: { phone: true } } } });
  if (!user || !user.isActive || user.role !== "SELLER") return null;
  const phone = user.phone ?? user.seller?.phone ?? null;
  return phone ? { id: user.id, phone } : null;
}

export async function requestPasswordReset(email: string) {
  const user = await sellerUserByEmail(email);
  // identical response whether or not the email exists (no account enumeration); devOtp only in OTP_DEV_MODE demos
  if (!user) return { sent: true as const, expiresInSec: 300 };
  const out = await issueOtp(user.phone);
  return { sent: true as const, expiresInSec: out.expiresInSec, ...(out.devOtp ? { devOtp: out.devOtp } : {}) };
}

export async function resetPassword(email: string, code: string, password: string) {
  const user = await sellerUserByEmail(email);
  if (!user) throw err.badRequest("That code is incorrect or has expired");
  const result = await checkOtp(user.phone, code);
  if (result === "invalid") throw err.badRequest("That code is incorrect");
  if (result === "expired") throw err.badRequest("The code has expired — request a new one");
  if (result === "locked") throw err.tooMany("Too many attempts — request a new code");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    // sign out every other device
    db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(user.id, "seller.password.reset", "User", user.id);
  return db.user.findUniqueOrThrow({ where: { id: user.id } });
}
