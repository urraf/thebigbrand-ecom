import "server-only";
import { z } from "zod";
import { db, Prisma, type AdCampaign, type CampaignStatus } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { campaignCode } from "@/lib/ids";
import { productCardSelect, toProductCard } from "@/server/catalog/cards";
import type { ProductCardData } from "@/types/shared";
import { PAGE_LABEL, slotViewUrls } from "./slots";
import { deliveryState, liveWhere, STATE_LABEL, STATE_TONE } from "./state";
import {
  addDaysKey,
  asJson,
  dateColKey,
  dayKeys,
  flatFlightCost,
  flightDays,
  isFlatModel,
  istDayKey,
  rateLabel,
  ratio,
  todayKey,
} from "./util";

/**
 * CAMPAIGNS — review queue, creative editor and lifecycle for every ad campaign.
 * Approving sets APPROVED + approvedBy/At and invalidates the ads cache, so the creative appears on the storefront
 * on the very next request (while its flight is running, the slot is active and budget remains).
 */

// ───────────────────────────── shapes ─────────────────────────────

const PRICING = ["DAY", "WEEK", "MONTH", "CPM", "CPC", "CLIP", "BOX"] as const;
const STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED", "PAUSED", "REJECTED", "ENDED"] as const;
const PAYMENT = ["UNPAID", "PAID", "INVOICED", "WAIVED"] as const;
export const DELIVERY_STATES = [
  "LIVE",
  "SCHEDULED",
  "FINISHED",
  "BUDGET_SPENT",
  "SLOT_PAUSED",
  "PENDING_REVIEW",
  "DRAFT",
  "PAUSED",
  "REJECTED",
  "ENDED",
] as const;

export const CAMPAIGN_LAYOUTS = ["", "split", "center", "image", "full"] as const;

const listInclude = {
  slot: { select: { id: true, code: true, name: true, page: true, size: true, format: true, isActive: true, positions: true } },
  brand: { select: { id: true, slug: true, name: true, word: true, sub: true, color: true, accent: true, font: true, fontWeight: true, textTransform: true, letterSpacing: true, italic: true, isOwn: true, logoUrl: true } },
  advertiser: { select: { id: true, companyName: true, contactName: true } },
} satisfies Prisma.AdCampaignInclude;

type CampaignWithRefs = Prisma.AdCampaignGetPayload<{ include: typeof listInclude }>;

export type CampaignListItem = ReturnType<typeof toListItem>;

function bookedValue(c: Pick<AdCampaign, "pricingModel" | "rate" | "budget" | "startsAt" | "endsAt" | "isHouse">): number {
  if (c.isHouse) return 0;
  if (isFlatModel(c.pricingModel)) return flatFlightCost(c.pricingModel, c.rate, flightDays(c.startsAt, c.endsAt));
  return c.budget;
}

function toListItem(c: CampaignWithRefs, now: Date, sellerName?: string | null) {
  const state = deliveryState(c, now);
  const days = flightDays(c.startsAt, c.endsAt);
  const elapsed = c.startsAt > now ? 0 : Math.min(days, flightDays(c.startsAt, now < c.endsAt ? now : c.endsAt));
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    headline: c.headline,
    kicker: c.kicker,
    subline: c.subline,
    ctaLabel: c.ctaLabel,
    theme: (c.theme ?? null) as { bg?: string; fg?: string; accent?: string } | null,
    imageUrl: c.imageUrl,
    isHouse: c.isHouse,
    status: c.status as CampaignStatus,
    state,
    stateLabel: STATE_LABEL[state],
    tone: STATE_TONE[state],
    slot: { code: c.slot.code, name: c.slot.name, page: c.slot.page, pageLabel: PAGE_LABEL[c.slot.page] ?? c.slot.page, size: c.slot.size, format: c.slot.format, isActive: c.slot.isActive },
    brand: c.brand,
    advertiser: c.advertiser ? { id: c.advertiser.id, name: c.advertiser.companyName } : null,
    sellerId: c.sellerId,
    sellerName: sellerName ?? null,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    days,
    elapsed,
    pricingModel: c.pricingModel,
    rate: c.rate,
    rateLabel: rateLabel(c.pricingModel, c.rate),
    budget: c.budget,
    bookedValue: bookedValue(c),
    spent: Math.round(c.spent),
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: ratio(c.clicks, c.impressions),
    paymentStatus: c.paymentStatus,
    rejectionReason: c.rejectionReason,
    priority: c.priority,
    weight: c.weight,
    createdAt: c.createdAt.toISOString(),
    approvedAt: c.approvedAt?.toISOString() ?? null,
  };
}

// ───────────────────────────── list ─────────────────────────────

export const campaignListQuery = z.object({
  status: z.enum(STATUSES).optional(),
  state: z.enum(DELIVERY_STATES).optional(),
  slot: z.string().trim().max(8).optional(),
  advertiser: z.string().trim().max(40).optional(),
  house: z.enum(["1", "0", "true", "false"]).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type CampaignListQuery = z.infer<typeof campaignListQuery>;

export async function listCampaigns(query: CampaignListQuery, now = new Date()) {
  const where: Prisma.AdCampaignWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.slot) where.slot = { code: query.slot.toUpperCase() };
  if (query.advertiser) where.advertiserId = query.advertiser;
  if (query.house) where.isHouse = query.house === "1" || query.house === "true";
  if (query.q) {
    const q = query.q;
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { headline: { contains: q, mode: "insensitive" } },
      { brand: { name: { contains: q, mode: "insensitive" } } },
      { advertiser: { companyName: { contains: q, mode: "insensitive" } } },
    ];
  }
  // delivery-state filters translate to DB conditions where possible
  if (query.state) {
    const s = query.state;
    if (s === "LIVE" || s === "BUDGET_SPENT" || s === "SLOT_PAUSED") {
      Object.assign(where, { status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now } });
      if (s === "SLOT_PAUSED") where.slot = { ...(where.slot as object), isActive: false };
      else where.slot = { ...(where.slot as object), isActive: true };
    } else if (s === "SCHEDULED") Object.assign(where, { status: "APPROVED", startsAt: { gt: now } });
    else if (s === "FINISHED") Object.assign(where, { status: "APPROVED", endsAt: { lt: now } });
    else where.status = s;
  }

  const rows = await db.adCampaign.findMany({
    where,
    include: listInclude,
    orderBy: [{ createdAt: "desc" }],
  });
  const sellerIds = [...new Set(rows.map((r) => r.sellerId).filter(Boolean))] as string[];
  const sellers = sellerIds.length
    ? new Map((await db.seller.findMany({ where: { id: { in: sellerIds } }, select: { id: true, displayName: true } })).map((s) => [s.id, s.displayName]))
    : new Map<string, string>();

  let items = rows.map((r) => toListItem(r, now, r.sellerId ? sellers.get(r.sellerId) : null));
  if (query.state === "LIVE" || query.state === "BUDGET_SPENT") items = items.filter((i) => i.state === query.state);

  const total = items.length;
  const pageItems = items.slice((query.page - 1) * query.limit, query.page * query.limit);
  return { items: pageItems, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) };
}

/** Counts for the campaigns overview + approval queue (all campaigns, not filtered). */
export async function campaignSummary(now = new Date()) {
  const [pending, live, all, monthBookings] = await Promise.all([
    db.adCampaign.findMany({ where: { status: "PENDING_REVIEW" }, include: listInclude, orderBy: { createdAt: "asc" } }),
    db.adCampaign.findMany({ where: liveWhere(now), select: { budget: true, spent: true, isHouse: true, pricingModel: true, rate: true, startsAt: true, endsAt: true } }),
    db.adCampaign.groupBy({ by: ["status"], _count: true }),
    db.adCampaign.findMany({
      where: { createdAt: { gte: new Date(`${todayKey(now).slice(0, 8)}01T00:00:00+05:30`) }, isHouse: false, status: { notIn: ["REJECTED", "DRAFT"] } },
      select: { pricingModel: true, rate: true, budget: true, startsAt: true, endsAt: true, isHouse: true },
    }),
  ]);
  const approvals = await db.adCampaign.findMany({
    where: { approvedAt: { not: null }, createdAt: { gte: new Date(now.getTime() - 90 * 86_400_000) } },
    select: { createdAt: true, approvedAt: true, createdById: true, approvedById: true },
  }).then((rows) => rows.filter((a) => a.createdById !== a.approvedById && a.approvedAt!.getTime() - a.createdAt.getTime() >= 60_000));
  const sellerIds = [...new Set(pending.map((r) => r.sellerId).filter(Boolean))] as string[];
  const sellers = sellerIds.length
    ? new Map((await db.seller.findMany({ where: { id: { in: sellerIds } }, select: { id: true, displayName: true } })).map((s) => [s.id, s.displayName]))
    : new Map<string, string>();
  const liveServing = live.filter((c) => c.budget === 0 || c.spent < c.budget);
  const avgApprovalMs = approvals.length
    ? approvals.reduce((t, a) => t + Math.max(0, a.approvedAt!.getTime() - a.createdAt.getTime()), 0) / approvals.length
    : null;
  return {
    pending: pending.map((p) => toListItem(p, now, p.sellerId ? sellers.get(p.sellerId) : null)),
    pendingValue: pending.reduce((t, p) => t + bookedValue(p), 0),
    liveCount: liveServing.length,
    liveValue: liveServing.reduce((t, c) => t + bookedValue(c), 0),
    byStatus: Object.fromEntries(all.map((r) => [r.status, r._count])) as Partial<Record<CampaignStatus, number>>,
    monthBookings: monthBookings.reduce((t, c) => t + bookedValue(c), 0),
    avgApprovalMs,
  };
}

// ───────────────────────────── detail ─────────────────────────────

export async function getCampaign(id: string, now = new Date()) {
  const c = await db.adCampaign.findFirst({
    where: { OR: [{ id }, { code: id }] },
    include: {
      ...listInclude,
      payments: { orderBy: { createdAt: "desc" }, select: { id: true, provider: true, amount: true, status: true, providerPaymentId: true, createdAt: true } },
    },
  });
  if (!c) return null;
  const [seller, products, stats, people, urls] = await Promise.all([
    c.sellerId ? db.seller.findUnique({ where: { id: c.sellerId }, select: { id: true, displayName: true } }) : null,
    c.productIds.length ? db.product.findMany({ where: { id: { in: c.productIds } }, select: productCardSelect }) : [],
    db.adStatDaily.findMany({ where: { campaignId: c.id }, orderBy: { date: "asc" } }),
    db.user.findMany({
      where: { id: { in: [c.createdById, c.approvedById].filter(Boolean) as string[] } },
      select: { id: true, name: true, email: true },
    }),
    slotViewUrls(),
  ]);
  const byId = new Map(products.map((p) => [p.id, toProductCard(p)]));
  const cards = c.productIds.map((pid) => byId.get(pid)).filter(Boolean) as ProductCardData[];

  // daily stats over the flight (to today), zero-filled
  const startKey = istDayKey(c.startsAt);
  const lastKey = [todayKey(now), istDayKey(c.endsAt)].sort()[0];
  const statMap = new Map(stats.map((s) => [dateColKey(s.date), s]));
  const firstStat = stats[0] ? dateColKey(stats[0].date) : null;
  const from = firstStat && firstStat < startKey ? firstStat : startKey;
  const daily =
    from <= lastKey
      ? dayKeys(from, lastKey).map((k) => {
          const s = statMap.get(k);
          return { date: k, impressions: s?.impressions ?? 0, clicks: s?.clicks ?? 0, spend: Math.round(s?.spend ?? 0) };
        })
      : [];
  const person = (uid: string | null) => {
    const u = people.find((p) => p.id === uid);
    return u ? u.name || u.email || "Admin" : null;
  };
  return {
    ...toListItem(c, now, seller?.displayName ?? null),
    linkUrl: c.linkUrl,
    mobileImageUrl: c.mobileImageUrl,
    videoUrl: c.videoUrl,
    layout: c.layout,
    productIds: c.productIds,
    products: cards,
    targetKey: c.targetKey,
    keywords: c.keywords,
    meta: (c.meta ?? null) as Record<string, unknown> | null,
    advertiserId: c.advertiserId,
    brandId: c.brandId,
    slotCode: c.slot.code,
    slotPositions: c.slot.positions,
    viewUrl: urls[c.slot.page] ?? null,
    createdBy: person(c.createdById),
    approvedBy: person(c.approvedById),
    payments: c.payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    daily,
  };
}
export type CampaignDetail = NonNullable<Awaited<ReturnType<typeof getCampaign>>>;

// ───────────────────────────── create / update ─────────────────────────────

const urlish = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\/[^\s"'<>]+$/i.test(v), "Use a site path like /brand/plum or a full https:// link")
  .refine((v) => !v.startsWith("//"), "Use a site path like /brand/plum or a full https:// link");

const cssValue = z
  .string()
  .trim()
  .max(240)
  .refine((v) => v === "" || (/^[#a-zA-Z0-9(),.%\s-]+$/.test(v) && !/url\s*\(|expression|javascript/i.test(v)), "Use a colour like #ff3d6e or a linear-gradient(…)");

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(2, "Give the campaign a name").max(120),
    slotCode: z.string().trim().toUpperCase().min(2).max(8),
    advertiserId: z.string().trim().max(40).nullish().transform((v) => v || null),
    brandId: z.string().trim().max(40).nullish().transform((v) => v || null),
    isHouse: z.boolean().default(false),
    kicker: optText(60),
    headline: z.string().trim().min(2, "Headline is required").max(140),
    subline: optText(220),
    ctaLabel: optText(40),
    linkUrl: urlish.nullish().transform((v) => v || null),
    imageUrl: urlish.nullish().transform((v) => v || null),
    mobileImageUrl: urlish.nullish().transform((v) => v || null),
    videoUrl: urlish.nullish().transform((v) => v || null),
    theme: z
      .object({ bg: cssValue.optional(), fg: cssValue.optional(), accent: cssValue.optional() })
      .nullish()
      .transform((t) => {
        if (!t) return null;
        const clean = Object.fromEntries(Object.entries(t).filter(([, v]) => v)) as Record<string, string>;
        return Object.keys(clean).length ? clean : null;
      }),
    layout: z.enum(CAMPAIGN_LAYOUTS).nullish().transform((v) => v || null),
    productIds: z.array(z.string().trim().min(5).max(40)).max(12).default([]),
    targetKey: optText(100),
    keywords: z
      .array(z.string().trim().toLowerCase().min(1).max(40))
      .max(25)
      .default([])
      .transform((k) => [...new Set(k)]),
    meta: z
      .record(z.string().max(40), z.union([z.string().max(300), z.number(), z.boolean(), z.array(z.union([z.string().max(60), z.number()])).max(12)]))
      .nullish()
      .transform((m) => (m && Object.keys(m).length ? m : null)),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    pricingModel: z.enum(PRICING),
    rate: z.coerce.number().min(0).max(10_000_000),
    budget: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
    priority: z.coerce.number().int().min(-100).max(100).default(0),
    weight: z.coerce.number().int().min(1).max(100).default(1),
    paymentStatus: z.enum(PAYMENT).optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "End date must be after the start date", path: ["endsAt"] })
  .refine((v) => v.isHouse || v.advertiserId || v.brandId, { message: "Pick an advertiser or brand (or mark it as a house campaign)", path: ["advertiserId"] });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

async function resolveRefs(input: CampaignInput) {
  const slot = await db.adSlot.findUnique({ where: { code: input.slotCode } });
  if (!slot) throw err.badRequest("Unknown ad slot", { fieldErrors: { slotCode: ["Pick a valid slot"] } });
  if (input.advertiserId && !(await db.advertiser.findUnique({ where: { id: input.advertiserId }, select: { id: true } })))
    throw err.badRequest("Unknown advertiser", { fieldErrors: { advertiserId: ["Pick a valid advertiser"] } });
  if (input.brandId && !(await db.brand.findUnique({ where: { id: input.brandId }, select: { id: true } })))
    throw err.badRequest("Unknown brand", { fieldErrors: { brandId: ["Pick a valid brand"] } });
  if (input.productIds.length) {
    const found = await db.product.count({ where: { id: { in: input.productIds } } });
    if (found !== new Set(input.productIds).size) throw err.badRequest("One or more products no longer exist", { fieldErrors: { productIds: ["Remove missing products"] } });
  }
  return slot;
}

function toData(input: CampaignInput, slotId: string) {
  return {
    name: input.name,
    slotId,
    advertiserId: input.advertiserId,
    brandId: input.brandId,
    isHouse: input.isHouse,
    kicker: input.kicker,
    headline: input.headline,
    subline: input.subline,
    ctaLabel: input.ctaLabel,
    linkUrl: input.linkUrl,
    imageUrl: input.imageUrl,
    mobileImageUrl: input.mobileImageUrl,
    videoUrl: input.videoUrl,
    theme: input.theme ?? undefined,
    layout: input.layout,
    productIds: [...new Set(input.productIds)],
    targetKey: input.targetKey,
    keywords: input.keywords,
    meta: input.meta ?? undefined,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    pricingModel: input.pricingModel,
    rate: Math.round(input.rate * 100) / 100,
    budget: input.budget,
    priority: input.priority,
    weight: input.weight,
    ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : input.isHouse ? { paymentStatus: "WAIVED" as const } : {}),
  } satisfies Prisma.AdCampaignUncheckedUpdateInput;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = campaignCode();
    if (!(await db.adCampaign.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw err.conflict("Could not allocate a campaign code, please retry");
}

export async function createCampaign(input: CampaignInput, actorId: string, opts: { approve?: boolean } = {}) {
  const slot = await resolveRefs(input);
  const data = toData(input, slot.id);
  const created = await db.adCampaign.create({
    data: {
      ...data,
      theme: data.theme,
      meta: data.meta,
      code: await uniqueCode(),
      status: "DRAFT",
      createdById: actorId,
      paymentStatus: data.paymentStatus ?? (input.isHouse ? "WAIVED" : "UNPAID"),
    },
  });
  await audit(actorId, "campaign.create", "AdCampaign", created.id, asJson({ code: created.code, slot: slot.code, isHouse: created.isHouse }));
  if (opts.approve) return campaignAction(created.id, "approve", {}, actorId);
  invalidate(TAGS.ads, TAGS.adSlot(slot.code));
  return getCampaignOrThrow(created.id);
}

export async function updateCampaign(id: string, input: CampaignInput, actorId: string) {
  const before = await db.adCampaign.findUnique({ where: { id }, include: { slot: { select: { code: true } } } });
  if (!before) throw err.notFound("Campaign not found");
  if (before.status === "ENDED") throw err.conflict("This campaign has ended — duplicate it to run it again");
  const slot = await resolveRefs(input);
  const data = toData(input, slot.id);
  const updated = await db.adCampaign.update({
    where: { id },
    data: { ...data, theme: data.theme ?? Prisma.DbNull, meta: data.meta ?? Prisma.DbNull },
  });
  invalidate(TAGS.ads, TAGS.adSlot(slot.code), ...(before.slot.code !== slot.code ? [TAGS.adSlot(before.slot.code)] : []));
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
    (k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((updated as Record<string, unknown>)[k] ?? null),
  );
  await audit(actorId, "campaign.update", "AdCampaign", id, asJson({ code: before.code, changed }));
  return getCampaignOrThrow(id);
}

async function getCampaignOrThrow(id: string) {
  const c = await getCampaign(id);
  if (!c) throw err.notFound("Campaign not found");
  return c;
}

// ───────────────────────────── lifecycle actions ─────────────────────────────

export const CAMPAIGN_ACTIONS = ["approve", "reject", "pause", "resume", "end", "duplicate", "submit"] as const;
export type CampaignAction = (typeof CAMPAIGN_ACTIONS)[number];

export const campaignActionSchema = z
  .object({
    action: z.enum(CAMPAIGN_ACTIONS),
    reason: z.string().trim().max(400).optional(),
  })
  .refine((v) => v.action !== "reject" || (v.reason && v.reason.length >= 3), { message: "Tell the advertiser why (at least 3 characters)", path: ["reason"] });

const ALLOWED: Record<Exclude<CampaignAction, "duplicate">, CampaignStatus[]> = {
  approve: ["DRAFT", "PENDING_REVIEW", "REJECTED"],
  reject: ["DRAFT", "PENDING_REVIEW", "APPROVED", "PAUSED"],
  pause: ["APPROVED"],
  resume: ["PAUSED"],
  end: ["DRAFT", "PENDING_REVIEW", "APPROVED", "PAUSED"],
  submit: ["DRAFT"],
};

const VERB: Record<CampaignAction, string> = {
  approve: "approve",
  reject: "reject",
  pause: "pause",
  resume: "resume",
  end: "end",
  duplicate: "duplicate",
  submit: "submit",
};

export async function campaignAction(id: string, action: CampaignAction, opts: { reason?: string }, actorId: string, now = new Date()) {
  const c = await db.adCampaign.findUnique({ where: { id }, include: { slot: { select: { code: true, isActive: true } } } });
  if (!c) throw err.notFound("Campaign not found");

  if (action === "duplicate") return duplicateCampaign(c, actorId, now);

  if (!ALLOWED[action].includes(c.status)) {
    throw err.conflict(`Can't ${VERB[action]} a campaign that is ${c.status.toLowerCase().replace("_", " ")}`);
  }

  let data: Prisma.AdCampaignUncheckedUpdateInput;
  switch (action) {
    case "approve":
      if (c.endsAt < now) throw err.unprocessable("This flight has already ended — move the end date before approving");
      if (!c.headline.trim()) throw err.unprocessable("Add a headline before approving");
      data = { status: "APPROVED", approvedById: actorId, approvedAt: now, rejectionReason: null };
      break;
    case "reject":
      data = { status: "REJECTED", rejectionReason: opts.reason ?? "Not approved" };
      break;
    case "pause":
      data = { status: "PAUSED" };
      break;
    case "resume":
      data = { status: "APPROVED" };
      break;
    case "end":
      data = { status: "ENDED", ...(c.endsAt > now ? { endsAt: now } : {}) };
      break;
    case "submit":
      data = { status: "PENDING_REVIEW" };
      break;
  }

  await db.adCampaign.update({ where: { id }, data });

  // a B1 approval switches the brand's paid storefront on for the flight
  if (action === "approve" && c.slot.code === "B1" && c.targetKey) {
    const brand = await db.brand.findUnique({ where: { slug: c.targetKey }, select: { id: true, slug: true, storeActiveUntil: true } });
    if (brand) {
      const until = brand.storeActiveUntil && brand.storeActiveUntil > c.endsAt ? brand.storeActiveUntil : c.endsAt;
      await db.brand.update({ where: { id: brand.id }, data: { storeActive: true, storeActiveUntil: until } });
      invalidate(TAGS.brands, TAGS.brand(brand.slug));
    }
  }

  invalidate(TAGS.ads, TAGS.adSlot(c.slot.code));
  await audit(actorId, `campaign.${action}`, "AdCampaign", id, asJson({ code: c.code, from: c.status, reason: opts.reason }));
  return getCampaignOrThrow(id);
}

async function duplicateCampaign(c: AdCampaign & { slot: { code: string } }, actorId: string, now: Date) {
  const days = flightDays(c.startsAt, c.endsAt);
  const startKey = addDaysKey(todayKey(now), 1);
  const startsAt = new Date(`${startKey}T00:00:00+05:30`);
  const endsAt = new Date(`${addDaysKey(startKey, days - 1)}T23:59:59+05:30`);
  const copy = await db.adCampaign.create({
    data: {
      code: await uniqueCode(),
      name: `${c.name} (copy)`.slice(0, 120),
      slotId: c.slotId,
      advertiserId: c.advertiserId,
      brandId: c.brandId,
      sellerId: c.sellerId,
      isHouse: c.isHouse,
      status: "DRAFT",
      priority: c.priority,
      weight: c.weight,
      kicker: c.kicker,
      headline: c.headline,
      subline: c.subline,
      ctaLabel: c.ctaLabel,
      linkUrl: c.linkUrl,
      imageUrl: c.imageUrl,
      mobileImageUrl: c.mobileImageUrl,
      videoUrl: c.videoUrl,
      theme: c.theme ?? undefined,
      layout: c.layout,
      productIds: c.productIds,
      targetKey: c.targetKey,
      keywords: c.keywords,
      meta: c.meta ?? undefined,
      startsAt,
      endsAt,
      pricingModel: c.pricingModel,
      rate: c.rate,
      budget: c.budget,
      paymentStatus: c.isHouse ? "WAIVED" : "UNPAID",
      createdById: actorId,
    },
  });
  await audit(actorId, "campaign.duplicate", "AdCampaign", copy.id, asJson({ from: c.code, code: copy.code }));
  return getCampaignOrThrow(copy.id);
}

/** Delete a campaign that never ran (DRAFT / REJECTED / ENDED with no delivery and no payments). */
export async function deleteCampaign(id: string, actorId: string) {
  const c = await db.adCampaign.findUnique({
    where: { id },
    include: { slot: { select: { code: true } }, _count: { select: { stats: true, payments: true } } },
  });
  if (!c) throw err.notFound("Campaign not found");
  if (!["DRAFT", "REJECTED", "ENDED"].includes(c.status)) throw err.conflict("Only drafts, rejected or ended campaigns can be deleted — end it first");
  if (c._count.stats || c._count.payments || c.impressions > 0) throw err.conflict("This campaign has delivery or payment history — end it instead of deleting");
  await db.adCampaign.delete({ where: { id } });
  invalidate(TAGS.ads, TAGS.adSlot(c.slot.code));
  await audit(actorId, "campaign.delete", "AdCampaign", id, asJson({ code: c.code, status: c.status }));
  return { id, deleted: true };
}

// ───────────────────────────── stats ─────────────────────────────

export async function campaignStats(id: string, now = new Date()) {
  const c = await getCampaign(id, now);
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    totals: { impressions: c.impressions, clicks: c.clicks, spend: c.spent, ctr: c.ctr, ecpm: ratio(c.spent, c.impressions) * 1000 },
    daily: c.daily,
  };
}

// ───────────────────────────── editor options ─────────────────────────────

export async function editorOptions() {
  const [slots, advertisers, brands, concerns] = await Promise.all([
    db.adSlot.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, name: true, page: true, size: true, format: true, pricingModel: true, rate: true, isActive: true, positions: true } }),
    db.advertiser.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, brandId: true } }),
    db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, word: true, sub: true, color: true, accent: true, font: true, fontWeight: true, textTransform: true, letterSpacing: true, italic: true, isOwn: true, logoUrl: true },
    }),
    db.concern.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, emoji: true } }),
  ]);
  return {
    concerns,
    slots: slots.map((s) => ({ ...s, pageLabel: PAGE_LABEL[s.page] ?? s.page, rateLabel: rateLabel(s.pricingModel, s.rate) })),
    advertisers: advertisers.map((a) => ({ id: a.id, name: a.companyName, brandId: a.brandId })),
    brands,
  };
}
export type EditorOptions = Awaited<ReturnType<typeof editorOptions>>;

export const productSearchQuery = z.object({
  q: z.string().trim().max(80).optional(),
  ids: z.string().trim().max(800).optional(),
  brandId: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(12),
});

export async function searchProducts(q: z.infer<typeof productSearchQuery>) {
  if (q.ids) {
    const ids = q.ids.split(",").filter(Boolean).slice(0, 12);
    const rows = await db.product.findMany({ where: { id: { in: ids } }, select: productCardSelect });
    const map = new Map(rows.map((r) => [r.id, toProductCard(r)]));
    return ids.map((i) => map.get(i)).filter(Boolean) as ProductCardData[];
  }
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  if (q.brandId) where.brandId = q.brandId;
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { brand: { name: { contains: q.q, mode: "insensitive" } } }, { slug: { contains: q.q, mode: "insensitive" } }];
  const rows = await db.product.findMany({ where, select: productCardSelect, orderBy: { soldCount: "desc" }, take: q.limit });
  return rows.map(toProductCard);
}

/** Defaults for a new campaign in a slot (flight: tomorrow for 7 days). */
export function newCampaignDefaults(slot: { code: string; pricingModel: AdCampaign["pricingModel"]; rate: number }, now = new Date()) {
  const startKey = addDaysKey(todayKey(now), 1);
  return {
    startsAt: `${startKey}T00:00:00+05:30`,
    endsAt: `${addDaysKey(startKey, 6)}T23:59:59+05:30`,
    pricingModel: slot.pricingModel,
    rate: slot.rate,
  };
}

