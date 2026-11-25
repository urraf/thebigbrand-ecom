import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, type Prisma } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { brandLiteSelect, productCardSelect, toBrandLite, toProductCard } from "@/server/catalog/cards";
import type { BrandLite, ProductCardData } from "@/types/shared";
import { isTimeBased } from "@/components/ads/lib/pricing";
import { addDaysIso, istDateKey, istEndOf, istStartOf } from "./dates";

/** Data for the Advertise page and the booking form (cached; busted by any ad change). */

export type BookableBrand = BrandLite & { tagline: string | null; products: ProductCardData[] };

export async function getBookableBrands(): Promise<BookableBrand[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.brands, TAGS.products);
  const brands = await db.brand.findMany({ where: { isOwn: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { ...brandLiteSelect, tagline: true } });
  const prods = await db.product.findMany({
    where: { brandId: { in: brands.map((b) => b.id) }, status: "ACTIVE", stock: { gt: 0 } },
    orderBy: [{ isFeatured: "desc" }, { soldCount: "desc" }],
    select: { ...productCardSelect, brandId: true },
  });
  return brands.map((b) => ({
    ...toBrandLite(b),
    tagline: b.tagline,
    products: prods.filter((p) => p.brandId === b.id).slice(0, 4).map(toProductCard),
  }));
}

/** Campaigns that hold paid inventory on a day: approved/paused, or awaiting review but already paid. */
const holdsInventory = (): Prisma.AdCampaignWhereInput => ({
  isHouse: false,
  OR: [{ status: { in: ["APPROVED", "PAUSED"] } }, { status: "PENDING_REVIEW", paymentStatus: "PAID" }],
});

export type SlotAvailability = { code: string; positions: number; exclusive: boolean; days: { date: string; booked: number }[] };

const HORIZON = 120;

/** Per-day booked positions for every bookable slot (next 120 days). Flat-priced slots sell exclusive positions. */
export async function getAvailability(): Promise<SlotAvailability[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.ads);
  const today = istDateKey();
  const horizonEnd = istEndOf(addDaysIso(today, HORIZON));
  const slots = await db.adSlot.findMany({ where: { OR: [{ bookable: true }, { code: { in: ["S3", "P1"] } }] }, orderBy: { sortOrder: "asc" } });
  const camps = await db.adCampaign.findMany({
    where: { slotId: { in: slots.map((s) => s.id) }, endsAt: { gte: istStartOf(today) }, startsAt: { lte: horizonEnd }, ...holdsInventory() },
    select: { slotId: true, startsAt: true, endsAt: true },
  });
  return slots.map((s) => {
    const mine = camps.filter((c) => c.slotId === s.id);
    const days = Array.from({ length: HORIZON }, (_, i) => {
      const date = addDaysIso(today, i);
      const a = istStartOf(date);
      const b = istEndOf(date);
      return { date, booked: mine.filter((c) => c.startsAt <= b && c.endsAt >= a).length };
    });
    return { code: s.code, positions: s.positions, exclusive: isTimeBased(s.pricingModel), days };
  });
}

/** Days in [start, end] on which a flat-priced slot is already full (used by booking to prevent overselling). */
export async function soldOutDays(slotId: string, positions: number, startsAt: Date, endsAt: Date): Promise<string[]> {
  const camps = await db.adCampaign.findMany({
    where: { slotId, startsAt: { lte: endsAt }, endsAt: { gte: startsAt }, ...holdsInventory() },
    select: { startsAt: true, endsAt: true },
  });
  if (camps.length < positions) return [];
  const out: string[] = [];
  for (let d = istDateKey(startsAt); d <= istDateKey(endsAt); d = addDaysIso(d, 1)) {
    const a = istStartOf(d);
    const b = istEndOf(d);
    if (camps.filter((c) => c.startsAt <= b && c.endsAt >= a).length >= positions) out.push(d);
    if (out.length > 120) break;
  }
  return out;
}

export type RecentBooking = { brand: string; slot: string; slotCode: string; start: string; end: string; status: string };

export async function getRecentBookings(): Promise<RecentBooking[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.ads);
  const rows = await db.adCampaign.findMany({
    where: { isHouse: false, status: { in: ["APPROVED", "PENDING_REVIEW", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { status: true, startsAt: true, endsAt: true, brand: { select: { name: true } }, slot: { select: { name: true, code: true } } },
  });
  return rows.map((r) => ({ brand: r.brand?.name ?? "A brand", slot: r.slot.name, slotCode: r.slot.code, start: istDateKey(r.startsAt), end: istDateKey(r.endsAt), status: r.status }));
}

export type CampaignResult = {
  brand: BrandLite | null;
  slotCode: string;
  slotName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  days: number;
  spent: number;
  pricingModel: string;
};

/** Best-performing live campaigns by CTR (real delivery data) — the "Results" section. */
export async function getTopResults(limit = 3): Promise<CampaignResult[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.ads);
  const rows = await db.adCampaign.findMany({
    where: { isHouse: false, impressions: { gte: 5000 }, status: { in: ["APPROVED", "ENDED"] } },
    select: { impressions: true, clicks: true, spent: true, startsAt: true, endsAt: true, pricingModel: true, brand: { select: brandLiteSelect }, slot: { select: { code: true, name: true } } },
    take: 200,
  });
  const now = Date.now();
  const seenSlot = new Set<string>();
  const seenBrand = new Set<string>();
  return rows
    .map((r) => ({ r, ctr: r.clicks / Math.max(1, r.impressions) }))
    .sort((a, b) => b.ctr - a.ctr)
    .filter(({ r }) => {
      const b = r.brand?.slug ?? "";
      if (seenSlot.has(r.slot.code) || seenBrand.has(b)) return false;
      seenSlot.add(r.slot.code);
      seenBrand.add(b);
      return true;
    })
    .slice(0, limit)
    .map(({ r, ctr }) => ({
      brand: r.brand ? toBrandLite(r.brand) : null,
      slotCode: r.slot.code,
      slotName: r.slot.name,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr,
      days: Math.max(1, Math.round((Math.min(now, r.endsAt.getTime()) - r.startsAt.getTime()) / 864e5)),
      spent: Math.round(r.spent),
      pricingModel: r.pricingModel,
    }));
}

export async function getSearchVolume30d(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.ads);
  return db.searchQuery.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } });
}

/** Today's IST date — passed to client components so they never read the clock while prerendering. */
export async function getTodayIso(): Promise<string> {
  "use cache";
  cacheLife("minutes");
  return istDateKey();
}

export type FestWindow = { name: string; dates: string; startsIn: number };

/** The next festive / sale windows sold as premium packages (computed from the calendar). */
export async function getFestWindows(): Promise<FestWindow[]> {
  "use cache";
  cacheLife("hours");
  const today = istDateKey();
  const year = Number(today.slice(0, 4));
  const defs: [string, string, string][] = [
    ["Black Friday Beauty Week", "11-27", "12-01"],
    ["Christmas & New Year Glow", "12-20", "01-01"],
    ["Republic Day Sale", "01-23", "01-26"],
    ["Valentine’s Week", "02-07", "02-14"],
    ["Holi Colour Fest", "03-01", "03-08"],
    ["Summer Skincare Sale", "05-15", "05-31"],
    ["End of Season Sale", "06-20", "07-05"],
    ["Independence Day Sale", "08-10", "08-16"],
    ["Diwali Glow Festival", "10-15", "11-05"],
  ];
  const fmtD = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const out: (FestWindow & { s: string })[] = [];
  for (const [name, a, b] of defs) {
    for (const y of [year - 1, year, year + 1]) {
      const s = `${y}-${a}`;
      const e = b < a ? `${y + 1}-${b}` : `${y}-${b}`;
      if (e < today) continue;
      out.push({ name, s, dates: `${fmtD(s)} – ${fmtD(e)}`, startsIn: Math.max(0, Math.round((Date.parse(s) - Date.parse(today)) / 864e5)) });
      break;
    }
  }
  return out.sort((x, y) => x.s.localeCompare(y.s)).slice(0, 4).map(({ name, dates, startsIn }) => ({ name, dates, startsIn }));
}
