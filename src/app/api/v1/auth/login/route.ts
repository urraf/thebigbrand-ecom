import { z } from "zod";
import { db } from "@/lib/db";
import { err, parseBody, rateLimit, route } from "@/lib/api";
import { clientIp, isAdminRole, verifyPassword } from "@/lib/auth";
import { signedInResponse } from "@/server/auth/session-response";

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  scope: z.enum(["customer", "admin", "seller"]).default("customer"),
});

/**
 * POST /api/v1/auth/login — email + password login.
 * scope "admin" requires ADMIN/STAFF; scope "seller" requires a SELLER account (approval is checked by the portal).
 */
export const POST = route({ auth: "public" }, async ({ req }) => {
  const { email, password, scope } = await parseBody(req, Body);
  rateLimit(`login:${email}`, 8, 10 * 60 * 1000);
  rateLimit(`login-ip:${clientIp(req) ?? "unknown"}`, 30, 10 * 60 * 1000);

  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await verifyPassword(password, user.passwordHash));
  if (!user || !ok) throw err.unauthorized("Incorrect email or password");
  if (!user.isActive) throw err.forbidden("This account is disabled");
  if (scope === "admin" && !isAdminRole(user.role)) throw err.forbidden("This account doesn't have admin access");
  if (scope === "seller" && user.role !== "SELLER" && user.role !== "ADMIN") throw err.forbidden("This isn't a seller account");

  let seller: { id: string; status: string; displayName: string } | null = null;
  if (scope === "seller") {
    seller = await db.seller.findUnique({ where: { userId: user.id }, select: { id: true, status: true, displayName: true } });
  }
  return signedInResponse(req, user, seller ? { seller } : {});
});
