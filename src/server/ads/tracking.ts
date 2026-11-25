import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { dailySpend } from "@/components/ads/lib/pricing";
import { istDay } from "./dates";

/**
 * Impression / click tracking and billing.
 *
 * Every accepted event upserts today's AdStatDaily row, recomputes that day's spend from the campaign's
 * pricing model + rate snapshot, keeps AdCampaign.impressions/clicks/spent as cached totals, caps spend at
 * the budget and auto-ends campaigns whose budget is exhausted or whose end date has passed.
 */

export type AdEventType = "impression" | "click";
export type AdEvent = { campaignId: string; type: AdEventType };

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|scrapy|phantom|selenium|puppeteer|playwright/i;

/** True for crawlers, link previews, monitoring and scripted clients (their events are ignored). */
export function isBotUA(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT_UA.test(ua);
}

/** Stable, non-reversible viewer key from ip + user agent (used only for short-lived de-duplication). */
export function viewerKey(ip: string | null, ua: string | null): string {
  return createHash("sha256").update(`${ip ?? "?"}|${ua ?? "?"}`).digest("base64url").slice(0, 22);
}

// ── short-lived de-duplication (per server instance): the same viewer can't inflate a campaign ──
const seen = new Map<string, number>();
const IMPRESSION_WINDOW_MS = 30_000; // one impression per viewer per campaign per 30 s (≈ a page view)
const CLICK_WINDOW_MS = 30_000; // one billable click per viewer per campaign per 30 s

function firstSeen(key: string, windowMs: number): boolean {
  const now = Date.now();
  const at = seen.get(key);
  if (at && now - at < windowMs) return false;
  seen.set(key, now);
  if (seen.size > 50_000) {
    for (const [k, t] of seen) if (now - t > 120_000) seen.delete(k);
  }
  return true;
}

let lastSweep = 0;
/** End campaigns whose schedule is over (cheap; throttled to once a minute per instance). */
export async function endExpiredCampaigns(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastSweep < 60_000) return 0;
  lastSweep = now;
  const expired = await db.adCampaign.findMany({
    where: { status: { in: ["APPROVED", "PAUSED"] }, endsAt: { lt: new Date(now) } },
    select: { id: true, code: true, slot: { select: { code: true } } },
    take: 200,
  });
  if (!expired.length) return 0;
  await db.adCampaign.updateMany({ where: { id: { in: expired.map((c) => c.id) } }, data: { status: "ENDED" } });
  for (const c of expired) await audit(null, "campaign.auto_end", "AdCampaign", c.id, { code: c.code, reason: "schedule_over" });
  invalidate(TAGS.ads, ...new Set(expired.map((c) => TAGS.adSlot(c.slot.code))));
  return expired.length;
}

export type RecordResult = { accepted: number; ignored: number; ended: string[] };

/**
 * Record a batch of events from one viewer. Unknown, non-live or duplicate events are ignored.
 * `clipsAsClicks` lets the coupon wall bill CLIP-priced H9 campaigns through the same path.
 */
export async function recordAdEvents(events: AdEvent[], viewer: string): Promise<RecordResult> {
  const counts = new Map<string, { impressions: number; clicks: number }>();
  let ignored = 0;
  for (const e of events) {
    const windowMs = e.type === "click" ? CLICK_WINDOW_MS : IMPRESSION_WINDOW_MS;
    if (!firstSeen(`${viewer}|${e.type}|${e.campaignId}`, windowMs)) {
      ignored++;
      continue;
    }
    const c = counts.get(e.campaignId) ?? { impressions: 0, clicks: 0 };
    if (e.type === "click") c.clicks++;
    else c.impressions++;
    counts.set(e.campaignId, c);
  }
  if (!counts.size) return { accepted: 0, ignored, ended: [] };

  const now = new Date();
  const campaigns = await db.adCampaign.findMany({
    where: { id: { in: [...counts.keys()] } },
    select: { id: true, code: true, status: true, startsAt: true, endsAt: true, isHouse: true, pricingModel: true, rate: true, budget: true, spent: true, slot: { select: { code: true, isActive: true } } },
  });
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const day = istDay(now);
  let accepted = 0;
  const ended: string[] = [];

  for (const [id, n] of counts) {
    const c = byId.get(id);
    const live = c && c.status === "APPROVED" && c.slot.isActive && c.startsAt <= now && c.endsAt >= now && (c.budget === 0 || c.spent < c.budget);
    if (!c || !live) {
      ignored += n.impressions + n.clicks;
      continue;
    }
    const res = await db.$transaction(async (tx) => {
      // the upsert locks today's row, so concurrent batches for this campaign serialise here
      const row = await tx.adStatDaily.upsert({
        where: { campaignId_date: { campaignId: id, date: day } },
        create: { campaignId: id, date: day, impressions: n.impressions, clicks: n.clicks, spend: 0 },
        update: { impressions: { increment: n.impressions }, clicks: { increment: n.clicks } },
      });
      const prevSpend = row.spend;
      let spend = c.isHouse ? 0 : dailySpend(c.pricingModel, c.rate, { impressions: row.impressions, clicks: row.clicks });
      let delta = Math.round((spend - prevSpend) * 100) / 100;
      const updated = await tx.adCampaign.update({
        where: { id },
        data: { impressions: { increment: n.impressions }, clicks: { increment: n.clicks }, spent: { increment: delta } },
        select: { spent: true, budget: true },
      });
      let exhausted = false;
      if (updated.budget > 0 && updated.spent >= updated.budget) {
        // never bill beyond the budget: trim today's spend by the overflow
        const overflow = Math.round((updated.spent - updated.budget) * 100) / 100;
        spend = Math.max(0, Math.round((spend - overflow) * 100) / 100);
        delta -= overflow;
        await tx.adCampaign.update({ where: { id }, data: { spent: updated.budget, status: "ENDED" } });
        exhausted = true;
      }
      if (spend !== prevSpend) await tx.adStatDaily.update({ where: { id: row.id }, data: { spend } });
      return { exhausted };
    });
    accepted += n.impressions + n.clicks;
    if (res.exhausted) {
      ended.push(c.code);
      await audit(null, "campaign.auto_end", "AdCampaign", c.id, { code: c.code, reason: "budget_exhausted" });
      invalidate(TAGS.ads, TAGS.adSlot(c.slot.code));
    }
  }
  return { accepted, ignored, ended };
}

/** Record one click (redirect endpoint). Returns the campaign's own destination for redirect validation. */
export async function recordClick(campaignId: string, viewer: string | null): Promise<{ linkUrl: string | null; brandSlug: string | null } | null> {
  const c = await db.adCampaign.findUnique({ where: { id: campaignId }, select: { linkUrl: true, brand: { select: { slug: true } } } });
  if (!c) return null;
  if (viewer) {
    try {
      await recordAdEvents([{ campaignId, type: "click" }], viewer);
    } catch (e) {
      console.error("[ads] click record failed", e);
    }
  }
  return { linkUrl: c.linkUrl, brandSlug: c.brand?.slug ?? null };
}
