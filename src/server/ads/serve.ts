import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, type Prisma } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { brandLiteSelect, productCardSelect, toBrandLite, toProductCard } from "@/server/catalog/cards";
import type { AdTheme, ProductCardData, ServedAd } from "@/types/shared";
import { clickUrlFor, isSafeRelativePath } from "@/components/ads/lib/links";
import { getZoneSlot, type ZoneSlot } from "./slots";

/**
 * AD SERVING
 *
 * getServedAds(code, context) returns the creatives to show in slot `code` right now:
 *   live = slot.isActive ∧ status APPROVED ∧ startsAt ≤ now ≤ endsAt ∧ (budget = 0 ∨ spent < budget)
 *   ordered by priority desc, then weighted rotation (re-shuffled every minute); house ads fill unsold
 *   positions; at most slot.positions items (H1 rotates up to 5). Context narrows targeting:
 *     H4 → targetKey = concern slug · S1/S2/S4 → keywords match `query` (+ category/brand/concern terms)
 *     S3/P1/C1 → sponsored products (targetKey/productIds; never out-of-stock or inactive products)
 *     P2 → product / category targeting · B1 → brandSlug.
 * Cached with 'use cache' + cacheLife('minutes') + cacheTag(TAGS.ads, TAGS.adSlot(code)) — admin changes
 * call invalidate(TAGS.ads) and show on the next request.
 */
export type AdContext = {
  query?: string;
  categorySlug?: string;
  productId?: string;
  brandSlug?: string;
  concern?: string;
  excludeProductIds?: string[];
};

/** Slots whose creatives are product cards (each campaign contributes 1+ sponsored products). */
export const PRODUCT_SLOTS = new Set(["S3", "P1", "C1"]);
/** Brand creatives that fall back to the brand's bestsellers when a booking picked no products. */
const BRAND_FILL_SLOTS = new Set(["H1", "H2", "H3", "H5", "H8", "H11", "S2", "S4", "P2", "C2"]);
const MAX_POSITIONS: Record<string, number> = { H1: 5 };

type NormCtx = {
  query?: string;
  categorySlug?: string;
  productId?: string;
  brandSlug?: string;
  concern?: string;
  exclude?: string[];
};

const clean = (s: string | undefined | null, max = 80) => {
  const v = (s ?? "").toString().trim().toLowerCase().slice(0, max);
  return v || undefined;
};

/** Keep only the context fields a slot actually targets on (better cache hit rate). */
function normalize(code: string, ctx: AdContext): NormCtx {
  const exclude = (ctx.excludeProductIds ?? []).filter((x) => typeof x === "string" && x.length < 40).slice(0, 60).sort();
  const ex = exclude.length ? exclude : undefined;
  switch (code) {
    case "H4":
      return { concern: clean(ctx.concern, 40) };
    case "S1":
    case "S2":
    case "S4":
      return { query: clean(ctx.query), categorySlug: clean(ctx.categorySlug, 60), brandSlug: clean(ctx.brandSlug, 60), concern: clean(ctx.concern, 40) };
    case "S3":
      return { query: clean(ctx.query), categorySlug: clean(ctx.categorySlug, 60), brandSlug: clean(ctx.brandSlug, 60), concern: clean(ctx.concern, 40), exclude: ex };
    case "P1":
      return { productId: ctx.productId?.slice(0, 40) || undefined, exclude: ex };
    case "P2":
      return { productId: ctx.productId?.slice(0, 40) || undefined, categorySlug: clean(ctx.categorySlug, 60) };
    case "C1":
      return { exclude: ex };
    case "B1":
      return { brandSlug: clean(ctx.brandSlug, 60) };
    default:
      return {};
  }
}

export async function getServedAds(code: string, context: AdContext = {}): Promise<ServedAd[]> {
  const c = String(code || "").toUpperCase().slice(0, 4);
  return (await serveZone(c, normalize(c, context))).ads;
}

/** Slot facts + creatives in one cached call (AdZone uses this for the inspector tag). */
export async function getZone(code: string, context: AdContext = {}): Promise<{ slot: ZoneSlot | null; ads: ServedAd[] }> {
  const c = String(code || "").toUpperCase().slice(0, 4);
  return serveZone(c, normalize(c, context));
}

// ───────────────────────────── implementation ─────────────────────────────

const servingProductSelect = {
  ...productCardSelect,
  status: true,
  tags: true,
  concerns: true,
  categoryId: true,
  brandId: true,
} satisfies Prisma.ProductSelect;
type ServingProduct = Prisma.ProductGetPayload<{ select: typeof servingProductSelect }>;

const campaignSelect = {
  id: true,
  code: true,
  isHouse: true,
  priority: true,
  weight: true,
  kicker: true,
  headline: true,
  subline: true,
  ctaLabel: true,
  linkUrl: true,
  imageUrl: true,
  mobileImageUrl: true,
  videoUrl: true,
  theme: true,
  layout: true,
  productIds: true,
  targetKey: true,
  keywords: true,
  meta: true,
  budget: true,
  spent: true,
  startsAt: true,
  sellerId: true,
  brand: { select: brandLiteSelect },
} satisfies Prisma.AdCampaignSelect;
type CampaignRow = Prisma.AdCampaignGetPayload<{ select: typeof campaignSelect }>;

async function serveZone(code: string, ctx: NormCtx): Promise<{ slot: ZoneSlot | null; ads: ServedAd[] }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.ads, TAGS.adSlot(code));

  const slot = await getZoneSlot(code);
  if (!slot || !slot.isActive) return { slot, ads: [] };

  const now = new Date();
  const rows = (
    await db.adCampaign.findMany({
      where: { slot: { code }, status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now } },
      select: campaignSelect,
    })
  ).filter((c) => c.budget === 0 || c.spent < c.budget);
  if (!rows.length) return { slot, ads: [] };

  // ── targeting ──
  let eligible = target(code, rows, ctx);
  if (!eligible.length) return { slot, ads: [] };

  // ── order: paid by priority + weighted rotation, then house ads fill the gaps ──
  const rand = seeded(`${code}|${JSON.stringify(ctx)}|${Math.floor(now.getTime() / 60000)}`);
  eligible = rotate(eligible.filter((c) => !c.row.isHouse), rand).concat(rotate(eligible.filter((c) => c.row.isHouse), rand));

  // H4: one sponsor per concern
  if (code === "H4") {
    const seen = new Set<string>();
    eligible = eligible.filter((c) => {
      const k = c.row.targetKey ?? "";
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const positions = Math.max(1, Math.min(slot.positions, MAX_POSITIONS[code] ?? slot.positions));

  // ── products ──
  const productIds = new Set<string>();
  for (const c of eligible) campaignProductIds(code, c.row).forEach((id) => productIds.add(id));
  if (ctx.productId) productIds.add(ctx.productId);
  const products = productIds.size
    ? await db.product.findMany({ where: { id: { in: [...productIds] } }, select: servingProductSelect })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  if (PRODUCT_SLOTS.has(code)) {
    return { slot, ads: sponsoredProducts(code, eligible, byId, ctx, positions) };
  }

  const picked = eligible.slice(0, positions);
  const fillBrands = [...new Set(picked.filter((c) => BRAND_FILL_SLOTS.has(code) && c.row.brand && !campaignProductIds(code, c.row).length).map((c) => c.row.brand!.id))];
  const brandFill = fillBrands.length ? await brandBestsellers(fillBrands) : new Map<string, ProductCardData[]>();

  const ads: ServedAd[] = [];
  for (const c of picked) {
    let prods = campaignProductIds(code, c.row)
      .map((id) => byId.get(id))
      .filter((p): p is ServingProduct => !!p && p.status === "ACTIVE")
      .map(toProductCard);
    if (!prods.length && c.row.brand) prods = brandFill.get(c.row.brand.id) ?? [];
    if (code === "H10" && !prods.length) continue; // a deal needs its product
    ads.push(await toServed(code, c.row, prods));
  }
  return { slot, ads };
}

type Scored = { row: CampaignRow; score: number };

function terms(ctx: NormCtx): string[] {
  const t = [ctx.query, ctx.categorySlug?.replace(/-/g, " "), ctx.brandSlug?.replace(/-/g, " "), ctx.concern].filter(Boolean) as string[];
  return t.map(fold);
}

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function target(code: string, rows: CampaignRow[], ctx: NormCtx): Scored[] {
  switch (code) {
    case "H4":
      return rows.filter((r) => r.targetKey && (!ctx.concern || r.targetKey.toLowerCase() === ctx.concern)).map((row) => ({ row, score: 1 }));
    case "S1":
    case "S2":
    case "S4": {
      const t = terms(ctx);
      const out: Scored[] = [];
      for (const row of rows) {
        const kws = row.keywords.map(fold).filter(Boolean);
        if (!kws.length) {
          out.push({ row, score: 0 }); // run of search
          continue;
        }
        if (!t.length) {
          out.push({ row, score: 0 });
          continue;
        }
        const hits = kws.filter((k) => t.some((q) => q.includes(k) || (q.length >= 3 && k.includes(q)))).length;
        if (hits > 0) out.push({ row, score: hits });
      }
      return out.sort((a, b) => b.score - a.score);
    }
    case "P2": {
      const out: Scored[] = [];
      for (const row of rows) {
        const key = row.targetKey?.toLowerCase() ?? null;
        if (ctx.productId && (row.targetKey === ctx.productId || row.productIds.includes(ctx.productId))) out.push({ row, score: 3 });
        else if (key && ctx.categorySlug && key === ctx.categorySlug) out.push({ row, score: 2 });
        else if (!key) out.push({ row, score: 1 });
      }
      return out.sort((a, b) => b.score - a.score);
    }
    case "B1":
      return rows
        .filter((r) => !ctx.brandSlug || r.brand?.slug === ctx.brandSlug || r.targetKey?.toLowerCase() === ctx.brandSlug)
        .map((row) => ({ row, score: 1 }));
    default:
      return rows.map((row) => ({ row, score: 0 }));
  }
}

/** Priority groups (desc), weighted random order inside each group (Efraimidis–Spirakis). */
function rotate(list: Scored[], rand: () => number): Scored[] {
  const keyed = list.map((c) => ({ c, k: Math.pow(rand(), 1 / Math.max(1, c.row.weight)) }));
  keyed.sort((a, b) => b.c.score - a.c.score || b.c.row.priority - a.c.row.priority || b.k - a.k);
  return keyed.map((x) => x.c);
}

function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function campaignProductIds(code: string, row: CampaignRow): string[] {
  const ids = [...row.productIds];
  // sponsored-product & deal slots may target one product through targetKey
  if ((PRODUCT_SLOTS.has(code) || code === "H10") && row.targetKey && !ids.includes(row.targetKey) && row.targetKey.length >= 20) ids.unshift(row.targetKey);
  return ids.filter((x, i, a) => a.indexOf(x) === i).slice(0, 12);
}

function relevance(p: ServingProduct, ctx: NormCtx, anchor: ServingProduct | undefined): number {
  if (anchor) {
    let s = 0.1;
    if (p.categoryId === anchor.categoryId) s += 3;
    if (p.concerns.some((c) => anchor.concerns.includes(c))) s += 2;
    if (p.brandId !== anchor.brandId) s += 0.5;
    return s;
  }
  const hasCtx = ctx.query || ctx.categorySlug || ctx.concern || ctx.brandSlug;
  if (!hasCtx) return 1;
  if (ctx.categorySlug && p.category.slug !== ctx.categorySlug) return 0;
  if (ctx.concern && !p.concerns.includes(ctx.concern)) return 0;
  if (ctx.brandSlug && p.brand.slug !== ctx.brandSlug) return 0;
  if (!ctx.query) return 1;
  const hay = fold([p.name, p.brand.name, p.brand.slug, p.category.slug.replace(/-/g, " "), ...p.tags, ...p.concerns].join(" "));
  const words = fold(ctx.query)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w));
  if (!words.length) return 0;
  const hits = words.filter((w) => hay.includes(w) || (w.endsWith("s") && hay.includes(w.slice(0, -1)))).length;
  return hits / words.length >= 0.5 ? hits / words.length : 0;
}
const STOP = new Set(["for", "the", "and", "with", "of", "in", "to", "a", "an", "best", "buy"]);

function sponsoredProducts(code: string, eligible: Scored[], byId: Map<string, ServingProduct>, ctx: NormCtx, positions: number): ServedAd[] {
  const anchor = code === "P1" && ctx.productId ? byId.get(ctx.productId) : undefined;
  const exclude = new Set([...(ctx.exclude ?? []), ...(ctx.productId ? [ctx.productId] : [])]);
  type Cand = { c: Scored; order: number; p: ServingProduct; rel: number };
  const cands: Cand[] = [];
  eligible.forEach((c, order) => {
    for (const id of campaignProductIds(code, c.row)) {
      const p = byId.get(id);
      if (!p || p.status !== "ACTIVE" || p.stock <= 0 || exclude.has(p.id)) continue;
      const rel = relevance(p, ctx, anchor);
      if (rel <= 0) continue;
      cands.push({ c, order, p, rel });
    }
  });
  cands.sort((a, b) => b.rel - a.rel || a.order - b.order);

  const seen = new Set<string>();
  const perCampaign = new Map<string, { row: CampaignRow; products: ProductCardData[] }>();
  let n = 0;
  for (const x of cands) {
    if (n >= positions) break;
    if (seen.has(x.p.id)) continue;
    seen.add(x.p.id);
    const entry = perCampaign.get(x.c.row.id) ?? { row: x.c.row, products: [] };
    entry.products.push(toProductCard(x.p));
    perCampaign.set(x.c.row.id, entry);
    n++;
  }
  // keep the relevance order of each campaign's first product
  return [...perCampaign.values()].map((e) => toServedSync(code, e.row, e.products));
}

/** Top ACTIVE in-stock products of each brand (fallback visuals for creatives booked without products). */
async function brandBestsellers(brandIds: string[]): Promise<Map<string, ProductCardData[]>> {
  const rows = await db.product.findMany({
    where: { brandId: { in: brandIds }, status: "ACTIVE", stock: { gt: 0 } },
    orderBy: [{ isFeatured: "desc" }, { soldCount: "desc" }],
    select: { ...productCardSelect, brandId: true },
    take: brandIds.length * 12,
  });
  const out = new Map<string, ProductCardData[]>();
  for (const r of rows) {
    const list = out.get(r.brandId) ?? [];
    if (list.length < 4) list.push(toProductCard(r));
    out.set(r.brandId, list);
  }
  return out;
}

function parseTheme(t: Prisma.JsonValue | null): AdTheme | null {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const o = t as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" && v.length < 300 ? v : undefined);
  return { bg: s(o.bg), fg: s(o.fg), accent: s(o.accent) };
}

function metaOf(m: Prisma.JsonValue | null): Record<string, unknown> {
  return m && typeof m === "object" && !Array.isArray(m) ? { ...(m as Record<string, unknown>) } : {};
}

/** Destination for a creative: same-site path, or an absolute https URL the advertiser set. */
function destination(row: CampaignRow, code: string, products: ProductCardData[]): string {
  const l = row.linkUrl?.trim();
  if (l && (isSafeRelativePath(l) || /^https:\/\/[^\s]+$/i.test(l))) return l;
  if (PRODUCT_SLOTS.has(code) && products[0]) return `/p/${products[0].slug}`;
  if (code === "H10" && products[0]) return `/p/${products[0].slug}`;
  if (row.brand) return `/brand/${row.brand.slug}`;
  return "/";
}

function toServedSync(code: string, row: CampaignRow, products: ProductCardData[]): ServedAd {
  const linkUrl = destination(row, code, products);
  return {
    id: row.id,
    code: row.code,
    slotCode: code,
    isHouse: row.isHouse,
    brand: row.brand ? toBrandLite(row.brand) : null,
    kicker: row.kicker,
    headline: row.headline,
    subline: row.subline,
    ctaLabel: row.ctaLabel,
    linkUrl,
    clickUrl: clickUrlFor(row.id, linkUrl),
    imageUrl: row.imageUrl,
    mobileImageUrl: row.mobileImageUrl,
    videoUrl: row.videoUrl,
    theme: parseTheme(row.theme),
    layout: row.layout,
    products,
    targetKey: row.targetKey,
    meta: metaOf(row.meta),
  };
}

async function toServed(code: string, row: CampaignRow, products: ProductCardData[]): Promise<ServedAd> {
  const ad = toServedSync(code, row, products);
  if (code === "H10" && products[0]) {
    // "claimed" = real sell-through of the deal product since the deal started
    const p = products[0];
    const sold = await db.orderItem.aggregate({
      where: { productId: p.id, order: { createdAt: { gte: row.startsAt }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } } },
      _sum: { qty: true },
    });
    // units sold in the deal window: real orders, or the "bought in past month" run-rate when that is higher
    const days = Math.min(30, Math.max(1, (Date.now() - row.startsAt.getTime()) / 864e5));
    const s = Math.max(sold._sum.qty ?? 0, Math.round((p.soldCount * days) / 30));
    const manual = typeof ad.meta.claimedPct === "number" ? (ad.meta.claimedPct as number) : null;
    ad.meta.claimedPct = manual ?? (s + p.stock > 0 ? Math.min(97, Math.max(1, Math.round((s / (s + p.stock)) * 100))) : 0);
    ad.meta.claimedUnits = s;
  }
  return ad;
}
