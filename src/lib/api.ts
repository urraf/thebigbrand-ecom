import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import type { Role, Seller } from "@/lib/db";
import { getApprovedSeller, getAuthFromRequest, isAdminRole, type AuthContext } from "@/lib/auth";

/**
 * REST API conventions for /api/v1/** (used by the web app now and the mobile apps later)
 *
 *   export const GET = route({ auth: "public" }, async ({ req, params, auth }) => { ...; return data })
 *
 * - Success: `{ "data": ... }` (status 200 unless you return a Response yourself).
 * - Error:   `{ "error": { "code": "NOT_FOUND", "message": "…", "details"?: … } }` with a matching HTTP status.
 * - auth: "public" (auth optional, ctx.auth may be null) · "user" (any signed-in user) ·
 *         "seller" (approved seller; ctx.seller set) · "admin" (ADMIN or STAFF) · "superadmin" (ADMIN only).
 * - Validate every input with zod via parseBody / parseQuery. Never trust client prices or totals.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const err = {
  badRequest: (message = "Invalid request", details?: unknown) => new ApiError(400, "BAD_REQUEST", message, details),
  unauthorized: (message = "Please sign in") => new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You don't have access to this") => new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message = "Conflict", details?: unknown) => new ApiError(409, "CONFLICT", message, details),
  unprocessable: (message = "Could not process request", details?: unknown) => new ApiError(422, "UNPROCESSABLE", message, details),
  tooMany: (message = "Too many requests, please try again shortly") => new ApiError(429, "RATE_LIMITED", message),
};

export type AuthMode = "public" | "user" | "seller" | "admin" | "superadmin";

export type RouteCtx<P> = {
  req: NextRequest;
  params: P;
  auth: AuthContext | null;
  /** set when auth === "seller" */
  seller: Seller | null;
};

type RouteOptions = { auth?: AuthMode; roles?: Role[] };

export function route<P extends Record<string, string> = Record<string, string>>(
  opts: RouteOptions,
  fn: (ctx: RouteCtx<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const params = (await context?.params) ?? ({} as P);
      const mode = opts.auth ?? "public";
      const auth = await getAuthFromRequest(req);
      let seller: Seller | null = null;

      if (mode !== "public" && !auth) throw err.unauthorized();
      if (auth && opts.roles && !opts.roles.includes(auth.user.role)) throw err.forbidden();
      if (mode === "admin" && !isAdminRole(auth!.user.role)) throw err.forbidden();
      if (mode === "superadmin" && auth!.user.role !== "ADMIN") throw err.forbidden("Admin access required");
      if (mode === "seller") {
        seller = await getApprovedSeller(auth!.user.id);
        if (!seller) throw err.forbidden("An approved seller account is required");
      }

      const out = await fn({ req, params, auth, seller });
      if (out instanceof Response) return out;
      return NextResponse.json({ data: out ?? null });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } },
      { status: e.status },
    );
  }
  if (e instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Please check the highlighted fields", details: z.flattenError(e) } },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw err.badRequest("Request body must be valid JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    const prev = obj[k];
    obj[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  return schema.parse(obj);
}

/** Standard pagination query: ?page=1&limit=24 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export function paged<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// ───────────── tiny in-memory rate limiter (per server instance) ─────────────
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw err.tooMany();
  hits.push(now);
  buckets.set(key, hits);
}
