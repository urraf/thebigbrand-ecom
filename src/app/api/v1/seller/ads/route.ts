import { z } from "zod";
import type { NextRequest } from "next/server";
import { parseBody, parseQuery, rateLimit, route } from "@/lib/api";
import { COOKIES } from "@/lib/site";
import { bookSellerCampaign, listSellerCampaigns } from "@/server/seller/ads";
import { BookSchema } from "@/server/seller/schemas";

const Query = z.object({ status: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "PAUSED", "REJECTED", "ENDED"]).optional() });

/** GET /api/v1/seller/ads — my sponsored-product campaigns with status, impressions, clicks, spend, CTR. */
export const GET = route({ auth: "seller" }, async ({ req, seller }) => {
  const q = parseQuery(req, Query);
  return listSellerCampaigns(seller!.id, { status: q.status });
});

function sessionToken(req: NextRequest): string | null {
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) return authz.slice(7);
  return req.cookies.get(COOKIES.session)?.value ?? null;
}

/**
 * POST /api/v1/seller/ads { productId, slotCode: S3|P1, startDate, endDate, budget, keywords? }
 * Validates seller rules (own, live, in-stock product) then books through POST /api/v1/ads/book over HTTP.
 */
export const POST = route({ auth: "seller" }, async ({ req, auth, seller }) => {
  rateLimit(`seller-book:${seller!.id}`, 20, 60 * 60 * 1000);
  const input = await parseBody(req, BookSchema);
  return bookSellerCampaign(seller!, auth!.user.id, input, sessionToken(req));
});
