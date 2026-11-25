import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/auth";
import { isSafeRelativePath } from "@/components/ads/lib/links";
import { isBotUA, recordClick, viewerKey } from "@/server/ads/tracking";

/**
 * GET /api/v1/ads/click/[campaignId]?to=/brand/plum  → records a click, then 302 to `to`.
 * Open-redirect safe: `to` must be a same-site relative path, or exactly the campaign's own linkUrl
 * (which may be an advertiser's https:// landing page). Anything else falls back to the campaign's linkUrl
 * (if same-site) or the home page. Clicks from bots and repeat clicks within 30 s are not billed.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const to = req.nextUrl.searchParams.get("to");
  const ua = req.headers.get("user-agent");
  let dest = "/";
  try {
    const validId = /^[a-z0-9]{10,40}$/i.test(id);
    const info = validId ? await recordClick(id, isBotUA(ua) ? null : viewerKey(clientIp(req), ua)) : null;
    if (to && isSafeRelativePath(to)) dest = to;
    else if (info?.linkUrl && to === info.linkUrl && /^https:\/\//i.test(info.linkUrl)) dest = info.linkUrl;
    else if (info?.linkUrl && isSafeRelativePath(info.linkUrl)) dest = info.linkUrl;
    else if (info?.brandSlug) dest = `/brand/${info.brandSlug}`;
  } catch (e) {
    console.error("[ads] click failed", e);
    if (to && isSafeRelativePath(to)) dest = to;
  }
  const url = /^https:\/\//i.test(dest) ? dest : new URL(dest, req.nextUrl.origin).toString();
  const res = NextResponse.redirect(url, 302);
  res.headers.set("cache-control", "no-store");
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return res;
}
