import "server-only";
import { db } from "@/lib/db";
import { err } from "@/lib/api";

/** PROFILE — name / email of the signed-in customer (phone is the OTP identity and is read-only here). */

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  hasPassword: boolean;
  memberSince: string;
};

export async function getProfile(userId: string): Promise<Profile> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, role: true, passwordHash: true, createdAt: true },
  });
  if (!u) throw err.notFound("Account not found");
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, hasPassword: Boolean(u.passwordHash), memberSince: u.createdAt.toISOString() };
}

export async function updateProfile(userId: string, input: { name?: string; email?: string }): Promise<Profile> {
  const current = await db.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, passwordHash: true } });
  if (!current) throw err.notFound("Account not found");
  const data: { name?: string; email?: string | null } = {};
  if (input.name !== undefined) data.name = input.name.replace(/\s+/g, " ");
  if (input.email !== undefined) {
    const email = input.email || null;
    if (!email && current.passwordHash && !current.phone) {
      throw err.unprocessable("Your email is how you sign in — add a mobile number before removing it");
    }
    if (email && email !== current.email) {
      const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (taken && taken.id !== userId) throw err.conflict("Another account already uses this email");
    }
    data.email = email;
  }
  await db.user.update({ where: { id: userId }, data });
  return getProfile(userId);
}
