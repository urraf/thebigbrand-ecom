import "server-only";
import { db, type Prisma, type Seller } from "@/lib/db";
import { ApiError, err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { env } from "@/lib/env";
import type { BookInput } from "./schemas";
import { getSellerSlots } from "./options";

/**
 * SPONSORED PRODUCTS for sellers. Campaigns are AdCampaign rows with sellerId = me.
 * Booking goes through the ads area's public contract — HTTP POST /api/v1/ads/book — with the seller's own
 * session forwarded, so pricing, review and billing rules live in one place (the ads agent owns them).
 * This module validates seller-side rules first: the product must be mine, live and in stock; slots S3 / P1 only.
 */

export type SellerCampaign = {
  id: string;
  code: string;
  name: string;
  status: string;
  slotCode: string;
  slotName: string;
  pricingModel: string;
  rate: number;
  startsAt: string;
  endsAt: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  ctr: number;
  paymentStatus: string;
  rejectionReason: string | null;
  keywords: string[];
  product: { id: string; name: string; slug: string; image: { url: string; alt: string | null } | null; art: { shape: string | null; c1: string | null; c2: string | null } } | null;
  pausedBySeller: boolean;
  live: boolean;
  /** past its end date (or ENDED) */
  ended: boolean;
  createdAt: string;
};

export async function listSellerCampaigns(sellerId: string, opts: { status?: string } = {}) {
  const now = new Date();
  const where: Prisma.AdCampaignWhereInput = { sellerId, ...(opts.status ? { status: opts.status as Prisma.EnumCampaignStatusFilter["equals"] } : {}) };
  const rows = await db.adCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { slot: { select: { code: true, name: true, isActive: true } } },
  });
  const productIds = [...new Set(rows.flatMap((r) => (r.productIds.length ? r.productIds : r.targetKey ? [r.targetKey] : [])))];
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds }, sellerId },
        select: { id: true, name: true, slug: true, shape: true, colorPrimary: true, colorSecondary: true, images: { select: { url: true, alt: true }, take: 1, orderBy: { sortOrder: "asc" } } },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const items: SellerCampaign[] = rows.map((r) => {
    const pid = r.productIds[0] ?? r.targetKey ?? null;
    const p = pid ? byId.get(pid) : undefined;
    const meta = (r.meta ?? {}) as { pausedBy?: string };
    const live = r.status === "APPROVED" && r.slot.isActive && r.startsAt <= now && now <= r.endsAt && (r.budget === 0 || r.spent < r.budget);
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      status: r.status,
      slotCode: r.slot.code,
      slotName: r.slot.name,
      pricingModel: r.pricingModel,
      rate: r.rate,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      budget: r.budget,
      spent: Math.round(r.spent * 100) / 100,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.impressions ? Math.round((r.clicks / r.impressions) * 10000) / 100 : 0,
      paymentStatus: r.paymentStatus,
      rejectionReason: r.rejectionReason,
      keywords: r.keywords,
      product: p
        ? { id: p.id, name: p.name, slug: p.slug, image: p.images[0] ?? null, art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary } }
        : null,
      pausedBySeller: r.status === "PAUSED" && meta.pausedBy === "seller",
      live,
      ended: r.status === "ENDED" || r.endsAt < now,
      createdAt: r.createdAt.toISOString(),
    };
  });
  const totals = items.reduce(
    (t, c) => ({ spent: t.spent + c.spent, impressions: t.impressions + c.impressions, clicks: t.clicks + c.clicks, live: t.live + (c.live ? 1 : 0) }),
    { spent: 0, impressions: 0, clicks: 0, live: 0 },
  );
  return { items, totals: { ...totals, spent: Math.round(totals.spent), ctr: totals.impressions ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0 } };
}

/** Products a seller can promote (live + in stock). */
export async function promotableProducts(sellerId: string) {
  return db.product.findMany({
    where: { sellerId, status: "ACTIVE", stock: { gt: 0 } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, price: true, mrp: true, stock: true, brand: { select: { name: true } }, shape: true, colorPrimary: true, colorSecondary: true, images: { select: { url: true, alt: true }, take: 1, orderBy: { sortOrder: "asc" } } },
  });
}

/** Book a sponsored-product campaign by calling the ads area over HTTP (POST /api/v1/ads/book). */
export async function bookSellerCampaign(seller: Seller, userId: string, input: BookInput, sessionToken: string | null) {
  const product = await db.product.findFirst({
    where: { id: input.productId, sellerId: seller.id },
    select: { id: true, name: true, slug: true, status: true, stock: true, brandId: true, price: true, brand: { select: { name: true } } },
  });
  if (!product) throw err.notFound("Product not found");
  if (product.status !== "ACTIVE") throw err.badRequest("Only live products can be promoted", { fieldErrors: { productId: ["This product isn't live yet"] } });
  if (product.stock <= 0) throw err.badRequest("This product is out of stock", { fieldErrors: { productId: ["Out of stock"] } });
  const slot = (await getSellerSlots()).find((s) => s.code === input.slotCode);
  if (!slot) throw err.badRequest("Choose a placement");
  if (!slot.isActive) throw err.conflict(`${slot.name} is paused right now — try the other placement`);
  if (!sessionToken) throw err.unauthorized();

  const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  if (input.startDate <= todayIst) throw err.badRequest("Campaigns start from tomorrow (we review every ad first)", { fieldErrors: { startDate: ["Pick tomorrow or later"] } });
  const days = Math.round((Date.parse(input.endDate) - Date.parse(input.startDate)) / 86_400_000) + 1;
  if (days > 90) throw err.badRequest("Campaigns can run up to 90 days", { fieldErrors: { endDate: ["Up to 90 days"] } });

  // exact body of the ads area's seller contract (its schema is strict — no extra keys)
  const payload = {
    asSeller: true,
    slotCode: slot.code,
    productIds: [product.id],
    headline: product.name.length > 48 ? `${product.name.slice(0, 47)}…` : product.name,
    keywords: input.keywords,
    startDate: input.startDate,
    endDate: input.endDate,
    budget: input.budget,
    agree: true as const,
  };

  let res: Response;
  try {
    res = await fetch(new URL("/api/v1/ads/book", env.appUrl), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, "ADS_UNAVAILABLE", "The booking service is unavailable — please try again in a minute");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: { code?: string; message?: string; details?: unknown } };
  if (res.status === 404 && !json.error) throw new ApiError(503, "ADS_UNAVAILABLE", "Sponsored-product booking isn't open yet — please try again shortly");
  if (!res.ok || json.error) {
    throw new ApiError(res.status >= 400 ? res.status : 502, json.error?.code ?? "BOOKING_FAILED", json.error?.message ?? "Booking failed", json.error?.details);
  }
  const data = (json.data ?? {}) as { campaign?: { code?: string; status?: string; paymentStatus?: string }; payment?: unknown; quote?: unknown };
  const code = data.campaign?.code ?? null;
  await audit(userId, "seller.campaign.book", "AdCampaign", code, { seller: seller.slug, slot: slot.code, product: product.id, budget: input.budget });
  invalidate(TAGS.ads, TAGS.adSlot(slot.code));
  return { campaign: data.campaign ?? null, payment: data.payment ?? null, quote: data.quote ?? null };
}

/** Pause / resume / withdraw my own campaign. Resume only undoes a pause the seller made (never an admin pause). */
export async function changeSellerCampaign(seller: Seller, userId: string, id: string, action: "pause" | "resume" | "withdraw") {
  const c = await db.adCampaign.findFirst({ where: { id, sellerId: seller.id }, include: { slot: { select: { code: true } } } });
  if (!c) throw err.notFound("Campaign not found");
  const meta = (c.meta ?? {}) as Record<string, unknown>;
  let data: Prisma.AdCampaignUpdateInput;
  if (action === "pause") {
    if (c.status !== "APPROVED") throw err.conflict("Only running campaigns can be paused");
    data = { status: "PAUSED", meta: { ...meta, pausedBy: "seller", pausedAt: new Date().toISOString() } as Prisma.InputJsonValue };
  } else if (action === "resume") {
    if (c.status !== "PAUSED" || meta.pausedBy !== "seller") throw err.conflict("This campaign was paused by The Big Brands — contact seller support");
    if (c.endsAt < new Date()) throw err.conflict("This campaign has already ended");
    const rest = { ...meta };
    delete rest.pausedBy;
    delete rest.pausedAt;
    data = { status: "APPROVED", meta: rest as Prisma.InputJsonValue };
  } else {
    if (!["PENDING_REVIEW", "DRAFT"].includes(c.status)) throw err.conflict("Only campaigns that are still in review can be withdrawn");
    if (c.paymentStatus === "PAID") throw err.conflict("This campaign is paid — contact seller support to cancel it and get a refund");
    data = { status: "ENDED", meta: { ...meta, withdrawnBy: "seller", withdrawnAt: new Date().toISOString() } as Prisma.InputJsonValue };
  }
  const next = await db.adCampaign.update({ where: { id }, data, select: { id: true, code: true, status: true } });
  await audit(userId, `seller.campaign.${action}`, "AdCampaign", id, { seller: seller.slug, from: c.status, to: next.status });
  invalidate(TAGS.ads, TAGS.adSlot(c.slot.code));
  return next;
}
