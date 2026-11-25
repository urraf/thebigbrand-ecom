import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { campaignCode } from "@/lib/ids";
import { createGatewayOrder, gatewayMode, publicGatewayConfig, verifyCheckoutSignature } from "@/lib/payments";
import { env } from "@/lib/env";
import type { AuthContext } from "@/lib/auth";
import { isSafeRelativePath } from "@/components/ads/lib/links";
import { MAX_CAMPAIGN_DAYS, MAX_PERF_BUDGET, MIN_LEAD_DAYS, MIN_PERF_BUDGET, isTimeBased, quoteBooking, rateLabel, type BookingQuote } from "@/components/ads/lib/pricing";
import { isHex, themeFromColor } from "@/components/ads/lib/theme";
import { addDaysIso, istDateKey, istEndOf, istStartOf } from "./dates";
import { soldOutDays } from "./advertise";

/**
 * SELF-SERVE BOOKING
 *  POST /api/v1/ads/book                    → creates/links the Advertiser, an AdCampaign (PENDING_REVIEW, UNPAID)
 *                                             with creative + schedule + rate snapshot + quoted cost, and a Payment
 *                                             (purpose AD_CAMPAIGN) through the gateway adapter.
 *  POST /api/v1/ads/book/[code]/pay/verify  → Razorpay signature (or TEST confirmation) → paymentStatus PAID.
 * Admin approval happens in the admin console; the campaign serves once APPROVED and inside its dates.
 * Sellers (approved) may book sponsored products (S3/P1) for their own ACTIVE products only.
 */

export const SELLER_SLOTS = ["S3", "P1"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const bookingSchema = z
  .object({
    slotCode: z.string().trim().toUpperCase().regex(/^[A-Z]\d{1,2}$/, "Unknown placement"),
    /** book as the signed-in approved seller (sponsored products S3/P1 for own products) */
    asSeller: z.boolean().optional().default(false),
    brandId: z.string().trim().min(1).max(40).optional(),
    brandSlug: z.string().trim().min(1).max(60).optional(),
    companyName: optText(80),
    contactName: optText(80),
    email: z.string().trim().email("Enter a valid email").max(120).optional().or(z.literal("").transform(() => undefined)),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    headline: z.string().trim().min(3, "Write a headline (at least 3 characters)").max(48, "Headlines can be up to 48 characters").optional(),
    subline: optText(70),
    ctaLabel: z.string().trim().min(2, "Add button text, e.g. “Shop now”").max(22).optional(),
    linkUrl: optText(300),
    color: z.string().trim().optional(),
    imageUrl: optText(500),
    mobileImageUrl: optText(500),
    productIds: z.array(z.string().trim().min(1).max(40)).max(8).optional().default([]),
    keywords: z.array(z.string().trim().min(2).max(40)).max(20).optional().default([]),
    startDate: isoDate,
    endDate: isoDate,
    /** performance slots (CPM/CPC/CLIP): campaign budget in ₹ excl. GST */
    budget: z.coerce.number().int().min(0).max(MAX_PERF_BUDGET).optional().default(0),
    agree: z.literal(true, { message: "Please confirm the ad follows our guidelines" }),
  })
  .strict();
export type BookingInput = z.input<typeof bookingSchema>;

export type BookingPayment = {
  id: string;
  mode: "RAZORPAY" | "TEST";
  keyId: string | null;
  providerOrderId: string | null;
  amount: number;
  currency: string;
  status: string;
};

export type BookingView = {
  code: string;
  name: string;
  status: string;
  paymentStatus: string;
  slot: { code: string; name: string; size: string; rateLabel: string };
  brand: { id: string; slug: string; name: string } | null;
  headline: string;
  subline: string | null;
  ctaLabel: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  theme: Prisma.JsonValue | null;
  startDate: string;
  endDate: string;
  pricingModel: string;
  rate: number;
  budget: number;
  quote: BookingQuote | null;
  sellerId: string | null;
  impressions: number;
  clicks: number;
  spent: number;
  createdAt: string;
  payment: BookingPayment | null;
};

const viewSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  paymentStatus: true,
  headline: true,
  subline: true,
  ctaLabel: true,
  linkUrl: true,
  imageUrl: true,
  theme: true,
  startsAt: true,
  endsAt: true,
  pricingModel: true,
  rate: true,
  budget: true,
  meta: true,
  sellerId: true,
  impressions: true,
  clicks: true,
  spent: true,
  createdAt: true,
  createdById: true,
  slot: { select: { code: true, name: true, size: true, pricingModel: true, rate: true } },
  brand: { select: { id: true, slug: true, name: true } },
  payments: { orderBy: { createdAt: "desc" as const }, take: 1, select: { id: true, provider: true, providerOrderId: true, amount: true, currency: true, status: true } },
} satisfies Prisma.AdCampaignSelect;
type ViewRow = Prisma.AdCampaignGetPayload<{ select: typeof viewSelect }>;

function toView(c: ViewRow): BookingView {
  const meta = (c.meta ?? {}) as { quote?: BookingQuote };
  const p = c.payments[0];
  return {
    code: c.code,
    name: c.name,
    status: c.status,
    paymentStatus: c.paymentStatus,
    slot: { code: c.slot.code, name: c.slot.name, size: c.slot.size, rateLabel: rateLabel(c.slot.pricingModel, c.slot.rate) },
    brand: c.brand,
    headline: c.headline,
    subline: c.subline,
    ctaLabel: c.ctaLabel,
    linkUrl: c.linkUrl,
    imageUrl: c.imageUrl,
    theme: c.theme,
    startDate: istDateKey(c.startsAt),
    endDate: istDateKey(c.endsAt),
    pricingModel: c.pricingModel,
    rate: c.rate,
    budget: c.budget,
    quote: meta.quote ?? null,
    sellerId: c.sellerId,
    impressions: c.impressions,
    clicks: c.clicks,
    spent: Math.round(c.spent * 100) / 100,
    createdAt: c.createdAt.toISOString(),
    payment: p
      ? {
          id: p.id,
          mode: p.provider === "RAZORPAY" ? "RAZORPAY" : "TEST",
          keyId: p.provider === "RAZORPAY" ? publicGatewayConfig().keyId : null,
          providerOrderId: p.providerOrderId,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
        }
      : null,
  };
}

/** Validate a same-site path or an https URL for the creative's destination. */
function cleanLink(link: string | undefined, fallback: string): string {
  if (!link) return fallback;
  if (isSafeRelativePath(link)) return link;
  if (/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(link)) return link;
  throw err.badRequest("Landing page must be a page on The Big Brands (e.g. /brand/plum) or an https:// link", {
    fieldErrors: { linkUrl: ["Use a store path like /brand/plum or an https:// link"] },
  });
}

/** Uploaded creatives must come from our own storage (local /uploads or the configured blob store). */
function cleanImage(url: string | undefined): string | null {
  if (!url) return null;
  if (/^\/uploads\/[\w/.-]+\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url) || /^\/media\/[\w/.-]+$/i.test(url)) return url;
  if (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)) return url;
  throw err.badRequest("Upload the creative image with the uploader", { fieldErrors: { imageUrl: ["Upload the image again"] } });
}

export function dateWindow(startDate: string, endDate: string) {
  const today = istDateKey();
  const minStart = addDaysIso(today, MIN_LEAD_DAYS);
  const errors: Record<string, string[]> = {};
  if (startDate < minStart) errors.startDate = [`Earliest start is ${minStart} (we need a day to review your ad)`];
  if (endDate < startDate) errors.endDate = ["End date must be on or after the start date"];
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 864e5) + 1;
  if (days > MAX_CAMPAIGN_DAYS) errors.endDate = [`Campaigns can run up to ${MAX_CAMPAIGN_DAYS} days`];
  if (Object.keys(errors).length) throw err.badRequest("Please check the campaign dates", { fieldErrors: errors });
  return { days, startsAt: istStartOf(startDate), endsAt: istEndOf(endDate) };
}

export async function bookCampaign(auth: AuthContext, raw: unknown, meta: { ip?: string | null } = {}): Promise<{ campaign: BookingView; payment: BookingPayment; quote: BookingQuote }> {
  const input = bookingSchema.parse(raw);
  const user = auth.user;

  const slot = await db.adSlot.findUnique({ where: { code: input.slotCode } });
  if (!slot) throw err.notFound("Unknown placement");

  // ── who is booking ──
  let sellerId: string | null = null;
  let sellerProducts: { id: string; brandId: string; name: string }[] = [];
  if (input.asSeller) {
    const seller = await db.seller.findUnique({ where: { userId: user.id } });
    if (!seller || seller.status !== "APPROVED") throw err.forbidden("An approved seller account is required");
    if (!(SELLER_SLOTS as readonly string[]).includes(slot.code)) throw err.forbidden("Sellers can book Sponsored Products (S3) and Related Sponsored Products (P1)");
    if (!input.productIds.length) throw err.badRequest("Pick at least one of your products to sponsor", { fieldErrors: { productIds: ["Pick a product"] } });
    sellerProducts = await db.product.findMany({
      where: { id: { in: input.productIds }, sellerId: seller.id, status: "ACTIVE" },
      select: { id: true, brandId: true, name: true },
    });
    if (sellerProducts.length !== new Set(input.productIds).size) throw err.forbidden("You can only sponsor your own active products");
    sellerId = seller.id;
  } else if (!slot.bookable) {
    throw err.forbidden("This placement is sold by our partnerships team — contact ads@thebigbrands.co.in");
  }

  // ── brand ──
  let brand: { id: string; slug: string; name: string; color: string; isOwn: boolean } | null = null;
  if (input.brandId || input.brandSlug) {
    brand = await db.brand.findFirst({
      where: input.brandId ? { id: input.brandId } : { slug: input.brandSlug },
      select: { id: true, slug: true, name: true, color: true, isOwn: true },
    });
    if (!brand) throw err.badRequest("Choose your brand", { fieldErrors: { brandId: ["Choose your brand"] } });
  } else if (sellerProducts.length) {
    brand = await db.brand.findUnique({ where: { id: sellerProducts[0].brandId }, select: { id: true, slug: true, name: true, color: true, isOwn: true } });
  }
  if (!brand) throw err.badRequest("Choose your brand", { fieldErrors: { brandId: ["Choose your brand"] } });
  if (brand.isOwn) throw err.badRequest("The Big Brands' own label is promoted with house ads", { fieldErrors: { brandId: ["Choose your brand"] } });

  // brand bookings: optional featured products must belong to that brand and be live
  let productIds: string[] = [];
  if (sellerId) productIds = sellerProducts.map((p) => p.id);
  else if (input.productIds.length) {
    const ok = await db.product.findMany({ where: { id: { in: input.productIds }, brandId: brand.id, status: "ACTIVE" }, select: { id: true } });
    productIds = ok.map((p) => p.id);
  }

  // ── schedule & money (recomputed here, never trusted from the client) ──
  const { days, startsAt, endsAt } = dateWindow(input.startDate, input.endDate);
  const timeBased = isTimeBased(slot.pricingModel);
  if (!timeBased && input.budget < MIN_PERF_BUDGET) {
    throw err.badRequest(`Minimum budget for ${slot.name} is ₹${MIN_PERF_BUDGET.toLocaleString("en-IN")}`, { fieldErrors: { budget: [`At least ₹${MIN_PERF_BUDGET.toLocaleString("en-IN")}`] } });
  }
  const quote = quoteBooking(slot, days, input.budget);
  // flat models round up to whole weeks/months: the campaign runs for the days that were paid for
  const finalEndsAt = timeBased && quote.run > days ? istEndOf(addDaysIso(input.startDate, quote.run - 1)) : endsAt;
  if (timeBased) {
    // flat-priced placements sell exclusive positions: never sell a day that is already full
    const full = await soldOutDays(slot.id, slot.positions, startsAt, finalEndsAt);
    if (full.length) {
      throw err.conflict(`${slot.name} is sold out on ${full.length} of those days (from ${full[0]}). Pick other dates.`, { soldOut: full, fieldErrors: { startDate: ["Sold out on some of these days"] } });
    }
  }

  const headline = input.headline ?? (sellerProducts[0]?.name.slice(0, 48) || null);
  if (!headline) throw err.badRequest("Write a headline (at least 3 characters)", { fieldErrors: { headline: ["Write a headline"] } });
  const color = input.color && isHex(input.color) ? input.color : brand.color;
  const linkUrl = cleanLink(input.linkUrl, sellerId && productIds.length === 1 ? "" : `/brand/${brand.slug}`) || null;

  // ── advertiser (created on first booking) ──
  let advertiser = await db.advertiser.findUnique({ where: { userId: user.id } });
  const company = input.companyName ?? advertiser?.companyName ?? (sellerId ? undefined : `${brand.name} India`);
  const contact = input.contactName ?? advertiser?.contactName ?? user.name ?? "Marketing team";
  const email = input.email ?? advertiser?.email ?? user.email;
  if (!email) throw err.badRequest("Enter an email for campaign updates and the GST invoice", { fieldErrors: { email: ["Enter your work email"] } });
  if (!advertiser) {
    let companyName = company;
    if (!companyName && sellerId) companyName = (await db.seller.findUnique({ where: { id: sellerId }, select: { businessName: true } }))?.businessName;
    advertiser = await db.advertiser.create({
      data: {
        userId: user.id,
        companyName: companyName ?? `${brand.name} India`,
        contactName: contact,
        email,
        phone: input.phone ?? user.phone ?? null,
        gstin: input.gstin ?? null,
        brandId: brand.id,
      },
    });
  } else {
    advertiser = await db.advertiser.update({
      where: { id: advertiser.id },
      data: {
        companyName: company ?? advertiser.companyName,
        contactName: contact,
        email,
        phone: input.phone ?? advertiser.phone,
        gstin: input.gstin ?? advertiser.gstin,
        brandId: advertiser.brandId ?? brand.id,
      },
    });
  }

  // ── campaign + payment ──
  let code = campaignCode();
  for (let i = 0; i < 4 && (await db.adCampaign.findUnique({ where: { code }, select: { id: true } })); i++) code = campaignCode();

  const campaign = await db.adCampaign.create({
    data: {
      code,
      name: `${brand.name} · ${slot.name}`,
      slotId: slot.id,
      advertiserId: advertiser.id,
      brandId: brand.id,
      sellerId,
      isHouse: false,
      status: "PENDING_REVIEW",
      priority: 10,
      weight: 1,
      kicker: null,
      headline,
      subline: input.subline ?? null,
      ctaLabel: input.ctaLabel ?? `Shop ${brand.name}`.slice(0, 22),
      linkUrl,
      imageUrl: cleanImage(input.imageUrl),
      mobileImageUrl: cleanImage(input.mobileImageUrl),
      theme: themeFromColor(color) as Prisma.InputJsonValue,
      productIds,
      targetKey: sellerId && productIds.length === 1 ? productIds[0] : null,
      keywords: input.keywords.map((k) => k.toLowerCase()),
      meta: { quote, color, bookedVia: sellerId ? "seller" : "self-serve", ip: meta.ip ?? null } as unknown as Prisma.InputJsonValue,
      startsAt,
      endsAt: finalEndsAt,
      pricingModel: slot.pricingModel,
      rate: quote.effectiveRate,
      budget: quote.budget,
      paymentStatus: "UNPAID",
      createdById: user.id,
    },
    select: { id: true, code: true },
  });

  const order = await createGatewayOrder(quote.total, campaign.code, { campaign: campaign.code, slot: slot.code, purpose: "AD_CAMPAIGN" });
  await db.payment.create({
    data: {
      purpose: "AD_CAMPAIGN",
      campaignId: campaign.id,
      provider: order.mode === "RAZORPAY" ? "RAZORPAY" : "TEST",
      providerOrderId: order.providerOrderId,
      amount: quote.total,
      currency: order.currency,
      status: "PENDING",
    },
  });

  await audit(user.id, "campaign.book", "AdCampaign", campaign.id, { code: campaign.code, slot: slot.code, total: quote.total, seller: sellerId });
  invalidate(TAGS.ads);

  const view = await getBooking(auth, campaign.code);
  return { campaign: view, payment: view.payment!, quote };
}

async function loadOwned(auth: AuthContext, code: string) {
  const c = await db.adCampaign.findUnique({ where: { code: code.toUpperCase() }, select: viewSelect });
  if (!c) throw err.notFound("Campaign not found");
  if (c.createdById !== auth.user.id) throw err.notFound("Campaign not found");
  return c;
}

export async function getBooking(auth: AuthContext, code: string): Promise<BookingView> {
  return toView(await loadOwned(auth, code));
}

export async function listMyBookings(auth: AuthContext): Promise<BookingView[]> {
  const rows = await db.adCampaign.findMany({ where: { createdById: auth.user.id }, orderBy: { createdAt: "desc" }, take: 50, select: viewSelect });
  return rows.map(toView);
}

export const verifySchema = z.union([
  z.object({
    razorpay_order_id: z.string().min(5).max(80),
    razorpay_payment_id: z.string().min(5).max(80),
    razorpay_signature: z.string().min(10).max(200),
  }),
  z.object({ test: z.literal(true), outcome: z.enum(["success", "failure"]) }),
]);

/** Confirm a booking payment: verified Razorpay signature, or the TEST gateway outside production. */
export async function verifyBookingPayment(auth: AuthContext, code: string, raw: unknown): Promise<BookingView> {
  const input = verifySchema.parse(raw);
  const c = await loadOwned(auth, code);
  if (c.paymentStatus === "PAID") return toView(c);
  const payment = await db.payment.findFirst({ where: { campaignId: c.id, purpose: "AD_CAMPAIGN" }, orderBy: { createdAt: "desc" } });
  if (!payment) throw err.conflict("No payment is pending for this campaign");

  if ("test" in input) {
    if (payment.provider !== "TEST" || gatewayMode() !== "TEST" || env.isProd) throw err.forbidden("Test payments are disabled");
    if (input.outcome === "failure") {
      await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", raw: { test: true, outcome: "failure" } } });
      await audit(auth.user.id, "campaign.payment_failed", "AdCampaign", c.id, { code: c.code, test: true });
      throw err.unprocessable("Payment failed — no money was taken. Try again.");
    }
    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: "PAID", providerPaymentId: `test_pay_${Date.now().toString(36)}`, raw: { test: true, outcome: "success" } } }),
      db.adCampaign.update({ where: { id: c.id }, data: { paymentStatus: "PAID" } }),
    ]);
  } else {
    if (payment.provider !== "RAZORPAY" || payment.providerOrderId !== input.razorpay_order_id) throw err.badRequest("Payment does not match this campaign");
    if (!verifyCheckoutSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
      await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", raw: { reason: "bad_signature" } } });
      throw err.unprocessable("We couldn't verify this payment. If money was debited it will be refunded automatically.");
    }
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", providerPaymentId: input.razorpay_payment_id, signature: input.razorpay_signature },
      }),
      db.adCampaign.update({ where: { id: c.id }, data: { paymentStatus: "PAID" } }),
    ]);
  }
  await audit(auth.user.id, "campaign.pay", "AdCampaign", c.id, { code: c.code, amount: payment.amount, provider: payment.provider });
  invalidate(TAGS.ads);
  return getBooking(auth, c.code);
}

/** Create a fresh gateway order for an unpaid booking (e.g. after a failed or abandoned payment). */
export async function retryBookingPayment(auth: AuthContext, code: string): Promise<BookingView> {
  const c = await loadOwned(auth, code);
  if (c.paymentStatus === "PAID") return toView(c);
  if (c.status === "REJECTED" || c.status === "ENDED") throw err.conflict("This campaign can no longer be paid for");
  const last = c.payments[0];
  const meta = (await db.adCampaign.findUnique({ where: { id: c.id }, select: { meta: true } }))?.meta as { quote?: BookingQuote } | null;
  const amount = meta?.quote?.total ?? last?.amount;
  if (!amount) throw err.conflict("No amount is due for this campaign");
  const order = await createGatewayOrder(amount, c.code, { campaign: c.code, purpose: "AD_CAMPAIGN" });
  await db.payment.create({
    data: { purpose: "AD_CAMPAIGN", campaignId: c.id, provider: order.mode === "RAZORPAY" ? "RAZORPAY" : "TEST", providerOrderId: order.providerOrderId, amount, currency: "INR", status: "PENDING" },
  });
  return getBooking(auth, c.code);
}
