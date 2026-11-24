import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection, type NextRequest, type NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db, type Role, type Seller } from "@/lib/db";
import { assertAuthSecret, env } from "@/lib/env";
import { COOKIES } from "@/lib/site";

/**
 * AUTH MODEL
 * - Stateless JWT (HS256) carrying { sub: userId, role, sid } + a Session row for revocation/logout.
 * - Web: httpOnly cookie `tbb_session`. Mobile apps (later): `Authorization: Bearer <token>`.
 * - Roles: CUSTOMER, SELLER, STAFF, ADMIN. Admin console = ADMIN | STAFF. Seller portal = SELLER with an APPROVED Seller.
 */

export const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

export type SessionClaims = { sub: string; role: Role; sid: string };

export type AuthUser = {
  id: string;
  role: Role;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type AuthContext = { user: AuthUser; sessionId: string };

export const ADMIN_ROLES: Role[] = ["ADMIN", "STAFF"];

// ───────────── passwords ─────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// ───────────── tokens ─────────────

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, sid: claims.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(assertAuthSecret());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, assertAuthSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.sid !== "string" || typeof payload.role !== "string") return null;
    return { sub: payload.sub, sid: payload.sid, role: payload.role as Role };
  } catch {
    return null;
  }
}

/** Creates a Session row and returns a signed token. Call after a successful login. */
export async function createSession(
  user: { id: string; role: Role },
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const session = await db.session.create({
    data: { userId: user.id, expiresAt, userAgent: meta.userAgent?.slice(0, 300), ip: meta.ip ?? null },
  });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await signSessionToken({ sub: user.id, role: user.role, sid: session.id });
  return { token, expiresAt, sessionId: session.id };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Validates claims against the DB (session not revoked/expired, user active). */
async function resolveClaims(claims: SessionClaims | null): Promise<AuthContext | null> {
  if (!claims) return null;
  const session = await db.session.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, role: true, name: true, email: true, phone: true, isActive: true } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.isActive || session.user.id !== claims.sub) return null;
  const { isActive: _active, ...user } = session.user;
  return { user, sessionId: session.id };
}

// ───────────── cookies ─────────────

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.isProd,
  path: "/",
  maxAge: SESSION_MAX_AGE,
});

/** For Route Handlers: attach the session cookie to a response. */
export function setSessionCookieOn(res: NextResponse, token: string) {
  res.cookies.set(COOKIES.session, token, cookieOptions());
  return res;
}

export function clearSessionCookieOn(res: NextResponse) {
  res.cookies.set(COOKIES.session, "", { ...cookieOptions(), maxAge: 0 });
  return res;
}

/** For Server Actions: set/clear the cookie via next/headers. */
export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIES.session, token, cookieOptions());
}

export async function clearSessionCookie() {
  (await cookies()).set(COOKIES.session, "", { ...cookieOptions(), maxAge: 0 });
}

// ───────────── reading the current user ─────────────

/** Server Components / Server Actions. Memoised per request. Dynamic (reads cookies) → wrap callers in <Suspense>. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  await connection(); // request-time only (JWT expiry check reads the clock)
  const jar = await cookies();
  let token = jar.get(COOKIES.session)?.value;
  if (!token) {
    const authz = (await headers()).get("authorization");
    if (authz?.startsWith("Bearer ")) token = authz.slice(7);
  }
  return resolveClaims(await verifySessionToken(token));
});

/** Route Handlers: supports both the cookie and `Authorization: Bearer`. */
export async function getAuthFromRequest(req: NextRequest | Request): Promise<AuthContext | null> {
  const authz = req.headers.get("authorization");
  let token: string | undefined;
  if (authz?.startsWith("Bearer ")) token = authz.slice(7);
  if (!token && "cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    token = (req as NextRequest).cookies.get(COOKIES.session)?.value;
  }
  if (!token) {
    const raw = req.headers.get("cookie") ?? "";
    const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIES.session}=([^;]+)`));
    token = m ? decodeURIComponent(m[1]) : undefined;
  }
  return resolveClaims(await verifySessionToken(token));
}

export function isAdminRole(role: Role | undefined | null): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

/** Approved seller record for a user (null if none / not approved). */
export async function getApprovedSeller(userId: string): Promise<Seller | null> {
  const seller = await db.seller.findUnique({ where: { userId } });
  return seller && seller.status === "APPROVED" ? seller : null;
}

// ───────────── page guards (redirect on failure) ─────────────

export async function requireUserPage(nextPath = "/account"): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return auth;
}

export async function requireAdminPage(nextPath = "/admin"): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth || !isAdminRole(auth.user.role)) redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  return auth;
}

export async function requireSellerPage(nextPath = "/seller"): Promise<AuthContext & { seller: Seller }> {
  const auth = await getAuth();
  if (!auth) redirect(`/seller/login?next=${encodeURIComponent(nextPath)}`);
  const seller = await db.seller.findUnique({ where: { userId: auth.user.id } });
  if (!seller) redirect("/seller/register");
  if (seller.status !== "APPROVED") redirect("/seller/status");
  return { ...auth, seller };
}

export function clientIp(req: NextRequest | Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}
