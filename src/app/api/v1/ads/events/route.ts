import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/auth";
import { ApiError, errorResponse, rateLimit } from "@/lib/api";
import { endExpiredCampaigns, isBotUA, recordAdEvents, viewerKey } from "@/server/ads/tracking";

/**
 * POST /api/v1/ads/events  { events: [{ campaignId, type: "impression" | "click" }] }  (max 50 per batch)
 *   → { data: { accepted, ignored } }
 * Batched beacon from the web tracker (navigator.sendBeacon, so the body may arrive as text/plain) and the
 * mobile apps. Impressions = ≥50% of the creative visible for 1 s. Bot-like user agents are ignored,
 * duplicates from the same viewer are dropped, and the endpoint is rate-limited per IP.
 * Web creatives link through /api/v1/ads/click/[id] (which records the click) — don't also send "click".
 */
const Body = z.object({
  events: z
    .array(z.object({ campaignId: z.string().trim().min(5).max(40), type: z.enum(["impression", "click"]) }))
    .min(1)
    .max(50),
});

export async function POST(req: Request) {
  try {
    const ua = req.headers.get("user-agent");
    const ip = clientIp(req);
    rateLimit(`adev:${ip ?? "anon"}`, 120, 60_000);
    let raw: unknown;
    try {
      raw = JSON.parse(await req.text());
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON");
    }
    const { events } = Body.parse(raw);
    if (isBotUA(ua)) return NextResponse.json({ data: { accepted: 0, ignored: events.length } });
    void endExpiredCampaigns().catch((e) => console.error("[ads] sweep failed", e));
    const res = await recordAdEvents(events, viewerKey(ip, ua));
    return NextResponse.json({ data: { accepted: res.accepted, ignored: res.ignored } });
  } catch (e) {
    return errorResponse(e);
  }
}
