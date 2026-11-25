import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError, err, route } from "@/lib/api";
import { expireUnpaidOrders } from "@/server/payments/service";

/**
 * GET|POST /api/v1/internal/cron/expire-orders
 * Cancels online orders still PENDING_PAYMENT 30+ minutes after creation (restores product stock, free-gift
 * stock and coupon uses). → { expired: string[], skipped: string[] }
 *
 * Auth: header `x-cron-secret: <CRON_SECRET>` — or `Authorization: Bearer <CRON_SECRET>`, which is what Vercel
 * Cron sends. Vercel: set the CRON_SECRET env var and add to vercel.json
 *   { "crons": [{ "path": "/api/v1/internal/cron/expire-orders", "schedule": "*\/10 * * * *" }] }
 * Without CRON_SECRET the route is closed in production; in development it accepts `x-cron-secret: dev`.
 */

function same(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function authorize(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("x-cron-secret") ?? (req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "");
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new ApiError(503, "NOT_CONFIGURED", "CRON_SECRET is not configured");
    if (given !== "dev") throw err.unauthorized("Send x-cron-secret: dev (development) or set CRON_SECRET");
    return;
  }
  if (!given || !same(given, secret)) throw err.unauthorized("Invalid cron secret");
}

const handler = route({ auth: "public" }, async ({ req }) => {
  authorize(req);
  const minutes = Math.min(24 * 60, Math.max(5, Number(req.nextUrl.searchParams.get("minutes")) || 30));
  const result = await expireUnpaidOrders(minutes);
  if (result.expired.length) console.info(`[cron] expired ${result.expired.length} unpaid order(s): ${result.expired.join(", ")}`);
  return { ...result, minutes, at: new Date().toISOString() };
});

export const GET = handler;
export const POST = handler;
