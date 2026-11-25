import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { brandLiteSelect, toBrandLite } from "@/server/catalog/cards";
import type { BrandLite } from "@/types/shared";
import { recordAdEvents } from "./tracking";

/**
 * Brand coupon wall (slot H9): sponsored Coupon rows. Clipping is per signed-in shopper (CouponClip) and
 * bumps Coupon.clipCount; when the brand runs a live CLIP-priced H9 campaign, each clip is billed to it.
 */

export type WallCoupon = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  minOrder: number;
  type: string;
  value: number;
  endsAt: string | null;
  /** "3 days left · till Tue, 1 Dec" (computed with the cached data) */
  expiresLabel: string;
  expiresSoon: boolean;
  clipCount: number;
  brand: BrandLite | null;
};

export async function getCouponWall(limit = 8): Promise<WallCoupon[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.coupons, TAGS.ads, TAGS.adSlot("H9"));
  const now = new Date();
  const rows = await db.coupon.findMany({
    where: {
      isSponsored: true,
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ endsAt: "asc" }, { clipCount: "desc" }],
    take: Math.min(24, Math.max(1, limit)),
    select: { id: true, code: true, title: true, description: true, minOrder: true, type: true, value: true, endsAt: true, clipCount: true, usageLimit: true, usedCount: true, brand: { select: brandLiteSelect } },
  });
  return rows
    .filter((r) => r.usageLimit == null || r.usedCount < r.usageLimit)
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      minOrder: r.minOrder,
      type: r.type,
      value: r.value,
      endsAt: r.endsAt ? r.endsAt.toISOString() : null,
      ...expiry(r.endsAt, now),
      clipCount: r.clipCount,
      brand: r.brand ? toBrandLite(r.brand) : null,
    }));
}

function expiry(end: Date | null, now: Date): { expiresLabel: string; expiresSoon: boolean } {
  if (!end) return { expiresLabel: "No expiry", expiresSoon: false };
  const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 864e5));
  const lbl = end.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const expiresLabel = days <= 0 ? "Ends today" : days <= 7 ? `${days} day${days > 1 ? "s" : ""} left · till ${lbl}` : `Valid till ${lbl}`;
  return { expiresLabel, expiresSoon: days <= 7 };
}

export async function getClippedCouponIds(userId: string): Promise<string[]> {
  const rows = await db.couponClip.findMany({ where: { userId }, select: { couponId: true } });
  return rows.map((r) => r.couponId);
}

export type ClipResult = { couponId: string; clipped: boolean; clipCount: number };

export async function clipCoupon(userId: string, couponId: string, viewer: string): Promise<ClipResult | null> {
  const now = new Date();
  const coupon = await db.coupon.findFirst({
    where: {
      id: couponId,
      isSponsored: true,
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    select: { id: true, brandId: true, clipCount: true },
  });
  if (!coupon) return null;
  const existing = await db.couponClip.findUnique({ where: { userId_couponId: { userId, couponId } } });
  if (existing) return { couponId, clipped: true, clipCount: coupon.clipCount };

  const updated = await db.$transaction(async (tx) => {
    await tx.couponClip.create({ data: { userId, couponId } });
    return tx.coupon.update({ where: { id: couponId }, data: { clipCount: { increment: 1 } }, select: { clipCount: true } });
  });

  // bill the clip to the brand's live CLIP-priced coupon-wall campaign, if any
  if (coupon.brandId) {
    const camp = await db.adCampaign.findFirst({
      where: { brandId: coupon.brandId, slot: { code: "H9" }, status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { priority: "desc" },
      select: { id: true },
    });
    if (camp) {
      try {
        await recordAdEvents([{ campaignId: camp.id, type: "click" }], `clip:${userId}:${couponId}|${viewer}`);
      } catch (e) {
        console.error("[ads] clip billing failed", e);
      }
    }
  }
  // no cache invalidation: the wall doesn't depend on clip counts and per-clip busting would thrash it
  return { couponId, clipped: true, clipCount: updated.clipCount };
}

export async function unclipCoupon(userId: string, couponId: string): Promise<ClipResult | null> {
  const existing = await db.couponClip.findUnique({ where: { userId_couponId: { userId, couponId } } });
  const coupon = await db.coupon.findUnique({ where: { id: couponId }, select: { clipCount: true } });
  if (!coupon) return null;
  if (!existing) return { couponId, clipped: false, clipCount: coupon.clipCount };
  await db.couponClip.delete({ where: { userId_couponId: { userId, couponId } } });
  // the brand already paid for the clip; clipCount stays (it counts clips, not current holders)
  return { couponId, clipped: false, clipCount: coupon.clipCount };
}
