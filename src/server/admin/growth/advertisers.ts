import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { brandLiteSelect } from "@/server/catalog/cards";
import { deliveryState, STATE_LABEL, STATE_TONE } from "./state";
import { asJson, flatFlightCost, flightDays, isFlatModel, istDayKey, ratio } from "./util";

/** ADVERTISERS — brands and agencies that buy ad space (self-serve from /advertise, or direct deals created here). */

export const advertiserListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function listAdvertisers(query: z.infer<typeof advertiserListQuery>, now = new Date()) {
  const where: Prisma.AdvertiserWhereInput = {};
  if (query.q) {
    where.OR = [
      { companyName: { contains: query.q, mode: "insensitive" } },
      { contactName: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
      { brand: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }
  const [rows, total] = await Promise.all([
    db.advertiser.findMany({
      where,
      orderBy: { companyName: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        brand: { select: brandLiteSelect },
        campaigns: {
          select: { status: true, startsAt: true, endsAt: true, budget: true, spent: true, impressions: true, clicks: true, slot: { select: { isActive: true } } },
        },
      },
    }),
    db.advertiser.count({ where }),
  ]);
  const ids = rows.map((r) => r.id);
  const paid = ids.length
    ? await db.payment.groupBy({
        by: ["campaignId"],
        where: { purpose: "AD_CAMPAIGN", status: "PAID", campaign: { advertiserId: { in: ids } } },
        _sum: { amount: true },
      })
    : [];
  const campaignOwner = ids.length
    ? new Map(
        (await db.adCampaign.findMany({ where: { advertiserId: { in: ids } }, select: { id: true, advertiserId: true } })).map((c) => [c.id, c.advertiserId]),
      )
    : new Map<string, string | null>();
  const paidByAdv = new Map<string, number>();
  for (const p of paid) {
    const adv = p.campaignId ? campaignOwner.get(p.campaignId) : null;
    if (adv) paidByAdv.set(adv, (paidByAdv.get(adv) ?? 0) + (p._sum.amount ?? 0));
  }

  const items = rows.map((a) => {
    const live = a.campaigns.filter((c) => deliveryState(c, now) === "LIVE").length;
    const pending = a.campaigns.filter((c) => c.status === "PENDING_REVIEW").length;
    const spend = a.campaigns.reduce((t, c) => t + c.spent, 0);
    const impressions = a.campaigns.reduce((t, c) => t + c.impressions, 0);
    const clicks = a.campaigns.reduce((t, c) => t + c.clicks, 0);
    return {
      id: a.id,
      companyName: a.companyName,
      contactName: a.contactName,
      email: a.email,
      phone: a.phone,
      gstin: a.gstin,
      hasLogin: Boolean(a.userId),
      brand: a.brand,
      campaigns: a.campaigns.length,
      live,
      pending,
      spend: Math.round(spend),
      paid: paidByAdv.get(a.id) ?? 0,
      impressions,
      clicks,
      ctr: ratio(clicks, impressions),
      createdAt: a.createdAt.toISOString(),
    };
  });
  return { items, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) };
}

export async function getAdvertiser(id: string, now = new Date()) {
  const a = await db.advertiser.findUnique({
    where: { id },
    include: {
      brand: { select: brandLiteSelect },
      user: { select: { id: true, email: true, name: true, lastLoginAt: true } },
      campaigns: {
        orderBy: { startsAt: "desc" },
        include: {
          slot: { select: { code: true, name: true, page: true, isActive: true } },
          brand: { select: brandLiteSelect },
          payments: { select: { id: true, provider: true, amount: true, status: true, providerPaymentId: true, createdAt: true } },
          stats: { select: { date: true, spend: true, impressions: true, clicks: true } },
        },
      },
    },
  });
  if (!a) return null;

  const months = new Map<string, { month: string; spend: number; impressions: number; clicks: number }>();
  for (const c of a.campaigns)
    for (const s of c.stats) {
      const m = s.date.toISOString().slice(0, 7);
      let row = months.get(m);
      if (!row) months.set(m, (row = { month: m, spend: 0, impressions: 0, clicks: 0 }));
      row.spend += s.spend;
      row.impressions += s.impressions;
      row.clicks += s.clicks;
    }

  const campaigns = a.campaigns.map((c) => {
    const state = deliveryState(c, now);
    const booked = c.isHouse ? 0 : isFlatModel(c.pricingModel) ? flatFlightCost(c.pricingModel, c.rate, flightDays(c.startsAt, c.endsAt)) : c.budget;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      headline: c.headline,
      brand: c.brand,
      slot: c.slot,
      status: c.status,
      state,
      stateLabel: STATE_LABEL[state],
      tone: STATE_TONE[state],
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      pricingModel: c.pricingModel,
      rate: c.rate,
      budget: c.budget,
      booked,
      spent: Math.round(c.spent),
      impressions: c.impressions,
      clicks: c.clicks,
      paymentStatus: c.paymentStatus,
    };
  });
  const payments = a.campaigns
    .flatMap((c) => c.payments.map((p) => ({ ...p, campaignCode: c.code, campaignId: c.id, createdAt: p.createdAt.toISOString() })))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));

  const spend = campaigns.reduce((t, c) => t + c.spent, 0);
  const impressions = campaigns.reduce((t, c) => t + c.impressions, 0);
  const clicks = campaigns.reduce((t, c) => t + c.clicks, 0);
  return {
    id: a.id,
    companyName: a.companyName,
    contactName: a.contactName,
    email: a.email,
    phone: a.phone,
    gstin: a.gstin,
    brandId: a.brandId,
    brand: a.brand,
    user: a.user ? { ...a.user, lastLoginAt: a.user.lastLoginAt?.toISOString() ?? null } : null,
    createdAt: a.createdAt.toISOString(),
    campaigns,
    payments,
    monthly: [...months.values()].sort((x, y) => x.month.localeCompare(y.month)).map((m) => ({ ...m, spend: Math.round(m.spend) })),
    totals: {
      spend,
      booked: campaigns.reduce((t, c) => t + c.booked, 0),
      paid: payments.filter((p) => p.status === "PAID").reduce((t, p) => t + p.amount, 0),
      impressions,
      clicks,
      ctr: ratio(clicks, impressions),
      live: campaigns.filter((c) => c.state === "LIVE").length,
      pending: campaigns.filter((c) => c.status === "PENDING_REVIEW").length,
      firstDay: campaigns.length ? istDayKey(new Date(Math.min(...a.campaigns.map((c) => c.startsAt.getTime())))) : null,
    },
  };
}
export type AdvertiserDetail = NonNullable<Awaited<ReturnType<typeof getAdvertiser>>>;

const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN")
  .nullish()
  .transform((v) => v || null);

export const advertiserInputSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(120),
  contactName: z.string().trim().min(2, "Contact name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?91/, ""))
    .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a 10-digit Indian mobile number")
    .nullish()
    .transform((v) => v || null),
  gstin,
  brandId: z.string().trim().max(40).nullish().transform((v) => v || null),
});
export type AdvertiserInput = z.infer<typeof advertiserInputSchema>;

async function checkBrand(brandId: string | null) {
  if (brandId && !(await db.brand.findUnique({ where: { id: brandId }, select: { id: true } }))) {
    throw err.badRequest("Unknown brand", { fieldErrors: { brandId: ["Pick a valid brand"] } });
  }
}

export async function createAdvertiser(input: AdvertiserInput, actorId: string) {
  await checkBrand(input.brandId);
  const a = await db.advertiser.create({ data: input });
  await audit(actorId, "advertiser.create", "Advertiser", a.id, asJson({ companyName: a.companyName }));
  return a;
}

export async function updateAdvertiser(id: string, input: Partial<AdvertiserInput>, actorId: string) {
  const before = await db.advertiser.findUnique({ where: { id } });
  if (!before) throw err.notFound("Advertiser not found");
  if (input.brandId !== undefined) await checkBrand(input.brandId);
  const a = await db.advertiser.update({ where: { id }, data: input });
  await audit(actorId, "advertiser.update", "Advertiser", id, asJson({ fields: Object.keys(input) }));
  return a;
}
