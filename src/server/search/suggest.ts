import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { formatINR } from "@/lib/money";
import { brandLiteSelect, toBrandLite } from "@/server/catalog/cards";
import type { BrandLite, ImageLite, PackshotArt } from "@/types/shared";

/**
 * SEARCH SUGGESTIONS for the header search box (GET /api/v1/search/suggest?q=&cat=).
 * The light catalogue index is cached ('use cache', tagged products/brands/categories/concerns/settings) and
 * matched in memory per keystroke — fast at any realistic catalogue size. The first row is the sponsored
 * suggestion (ad slot S1).
 */

export type SuggestProduct = {
  id: string;
  slug: string;
  name: string;
  size: string | null;
  price: number;
  mrp: number;
  brandName: string;
  image: ImageLite | null;
  art: PackshotArt;
  isOwnLabel: boolean;
  brand: Pick<BrandLite, "name" | "word" | "isOwn">;
};

export type SponsoredSuggestion = {
  campaignId: string;
  code: string;
  isHouse: boolean;
  text: string;
  subline: string | null;
  brand: BrandLite | null;
  linkUrl: string;
  /** tracked redirect through the ads click endpoint */
  href: string;
  slot: { code: string; name: string; size: string; rateLabel: string };
};

export type SuggestResult = {
  q: string;
  sponsored: SponsoredSuggestion | null;
  concerns: { slug: string; name: string; emoji: string | null }[];
  brands: { slug: string; name: string }[];
  products: SuggestProduct[];
  trending: string[];
};

const DEFAULT_TRENDING = ["vitamin c serum", "onion hair oil", "sunscreen spf 50", "salicylic face wash", "beard oil", "perfume for men", "kajal", "body lotion"];

/** "L'Oréal Paris" → "loreal paris" */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

const words = (s: string) => normalize(s).split(" ").filter(Boolean);

type IndexedProduct = SuggestProduct & {
  categorySlug: string;
  nameWords: string[];
  brandWords: string[];
  otherWords: string[];
  nameNorm: string;
  pop: number;
};

type SuggestIndex = {
  products: IndexedProduct[];
  productSlugs: Set<string>;
  brandSlugs: Set<string>;
  brands: { slug: string; name: string; words: string[] }[];
  concerns: { slug: string; name: string; emoji: string | null; words: string[] }[];
  trending: string[];
};

/** Cached light index of the live catalogue. */
async function getSuggestIndex(): Promise<SuggestIndex> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products, TAGS.brands, TAGS.categories, TAGS.concerns, TAGS.settings);

  const [products, brands, concerns, trendingRow] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        name: true,
        size: true,
        price: true,
        mrp: true,
        tags: true,
        concerns: true,
        soldCount: true,
        rating: true,
        isOwnLabel: true,
        shape: true,
        colorPrimary: true,
        colorSecondary: true,
        meta: true,
        brand: { select: { name: true, word: true, isOwn: true } },
        category: { select: { slug: true, name: true } },
        images: { select: { url: true, alt: true, width: true, height: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    db.brand.findMany({ select: { slug: true, name: true, word: true }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }] }),
    db.concern.findMany({ select: { slug: true, name: true, emoji: true }, orderBy: { sortOrder: "asc" } }),
    db.setting.findUnique({ where: { key: "trending" } }),
  ]);

  const concernName = new Map(concerns.map((c) => [c.slug, c.name]));
  const trending = Array.isArray(trendingRow?.value) ? (trendingRow!.value as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 10) : DEFAULT_TRENDING;

  return {
    products: products.map((p) => {
      const meta = (p.meta ?? {}) as { line?: string };
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        size: p.size,
        price: p.price,
        mrp: p.mrp,
        brandName: p.brand.name,
        image: p.images[0] ?? null,
        art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary, line: meta.line ?? null },
        isOwnLabel: p.isOwnLabel,
        brand: p.brand,
        categorySlug: p.category.slug,
        nameWords: words(p.name),
        nameNorm: normalize(p.name),
        brandWords: [...new Set([...words(p.brand.name), ...words(p.brand.word ?? "")])],
        otherWords: [...new Set([...words(p.category.name), ...p.tags.flatMap(words), ...p.concerns.flatMap((c) => words(concernName.get(c) ?? c))])],
        pop: p.soldCount + p.rating * 100,
      };
    }),
    productSlugs: new Set(products.map((p) => p.slug)),
    brandSlugs: new Set(brands.map((b) => b.slug)),
    brands: brands.map((b) => ({ slug: b.slug, name: b.name, words: [...new Set([...words(b.name), ...words(b.word ?? ""), b.slug])] })),
    concerns: concerns.map((c) => ({ ...c, words: [...new Set([...words(c.name), c.slug])] })),
    trending: trending.length ? trending : DEFAULT_TRENDING,
  };
}

// ───────────────────────────── sponsored suggestion (slot S1) ─────────────────────────────

type S1Campaign = {
  id: string;
  code: string;
  isHouse: boolean;
  priority: number;
  weight: number;
  headline: string;
  subline: string | null;
  linkUrl: string | null;
  keywords: string[];
  startsAt: number;
  endsAt: number;
  budget: number;
  spent: number;
  brand: BrandLite | null;
};

type S1Data = { slot: SponsoredSuggestion["slot"]; campaigns: S1Campaign[] } | null;

function rateLabel(model: string, rate: number): string {
  const r = model === "CLIP" || model === "BOX" ? `₹${rate}` : formatINR(rate);
  return { DAY: `${r}/day`, WEEK: `${r}/week`, MONTH: `${r}/month`, CPM: `${r} CPM`, CPC: `${r} CPC`, CLIP: `${r}/clip`, BOX: `${r}/box` }[model] ?? r;
}

/** Approved S1 campaigns on an active slot (dates/budget are checked per request). */
async function getS1Data(): Promise<S1Data> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.ads, TAGS.adSlot("S1"));
  const slot = await db.adSlot.findUnique({ where: { code: "S1" }, select: { id: true, isActive: true, name: true, size: true, format: true, pricingModel: true, rate: true } });
  if (!slot || !slot.isActive) return null;
  const rows = await db.adCampaign.findMany({
    where: { slotId: slot.id, status: "APPROVED" },
    orderBy: [{ priority: "desc" }, { weight: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      code: true,
      isHouse: true,
      priority: true,
      weight: true,
      headline: true,
      subline: true,
      linkUrl: true,
      keywords: true,
      startsAt: true,
      endsAt: true,
      budget: true,
      spent: true,
      brand: { select: brandLiteSelect },
    },
  });
  return {
    slot: { code: "S1", name: slot.name, size: slot.format === "Text" ? "Text" : slot.size, rateLabel: rateLabel(slot.pricingModel, slot.rate) },
    campaigns: rows.map((c) => ({
      ...c,
      keywords: c.keywords.map(normalize).filter(Boolean),
      startsAt: c.startsAt.getTime(),
      endsAt: c.endsAt.getTime(),
      brand: c.brand ? toBrandLite(c.brand) : null,
    })),
  };
}

/**
 * Landing page for a sponsored suggestion. Internal links are checked against the live catalogue so a typo or
 * an archived product in the creative never sends a paid click to a 404: unknown /p/… or /brand/… targets fall
 * back to the advertiser's brand store, else a search for the headline. Only site-relative or https URLs pass.
 */
const decode = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

function safeLanding(c: S1Campaign, index: SuggestIndex): string {
  const fallback = c.brand && index.brandSlugs.has(c.brand.slug) ? `/brand/${c.brand.slug}` : `/s?q=${encodeURIComponent(c.headline.slice(0, 60))}`;
  const url = (c.linkUrl ?? "").trim();
  if (!url) return fallback;
  if (/^https:\/\//i.test(url)) return url;
  if (!url.startsWith("/") || url.startsWith("//")) return fallback;
  const product = url.match(/^\/p\/([^/?#]+)/);
  if (product) return index.productSlugs.has(decode(product[1])) ? url : fallback;
  const brand = url.match(/^\/brand\/([^/?#]+)/);
  if (brand) return index.brandSlugs.has(decode(brand[1])) ? url : fallback;
  return url;
}

function pickSponsored(data: S1Data, index: SuggestIndex, qn: string, now: number): SponsoredSuggestion | null {
  if (!data) return null;
  const live = data.campaigns.filter((c) => c.startsAt <= now && now <= c.endsAt && (c.budget === 0 || c.spent < c.budget));
  if (!live.length) return null;
  const match = qn
    ? live.find((c) => c.keywords.some((k) => qn.includes(k) || (qn.length >= 2 && k.includes(qn))))
    : undefined;
  // no keyword match → the highest-priority campaign, preferring run-of-site (no keywords) creatives
  const top = live[0].priority;
  const pick = match ?? live.find((c) => c.priority === top && c.keywords.length === 0) ?? live[0];
  const linkUrl = safeLanding(pick, index);
  return {
    campaignId: pick.id,
    code: pick.code,
    isHouse: pick.isHouse,
    text: pick.headline,
    subline: pick.subline,
    brand: pick.brand,
    linkUrl,
    href: `/api/v1/ads/click/${encodeURIComponent(pick.id)}?to=${encodeURIComponent(linkUrl)}`,
    slot: data.slot,
  };
}

// ───────────────────────────── matching ─────────────────────────────

const hits = (tokens: string[], pool: string[]) => tokens.filter((t) => pool.some((w) => w.startsWith(t))).length;

function strip(p: IndexedProduct): SuggestProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    size: p.size,
    price: p.price,
    mrp: p.mrp,
    brandName: p.brandName,
    image: p.image,
    art: p.art,
    isOwnLabel: p.isOwnLabel,
    brand: p.brand,
  };
}

export async function getSuggestions(rawQ: string, cat?: string | null, now = Date.now()): Promise<SuggestResult> {
  const q = rawQ.trim().slice(0, 80);
  const qn = normalize(q);
  const [index, s1] = await Promise.all([getSuggestIndex(), getS1Data()]);
  const sponsored = pickSponsored(s1, index, qn, now);
  if (!qn) return { q, sponsored, concerns: [], brands: [], products: [], trending: index.trending };

  const tokens = qn.split(" ").filter(Boolean);
  const category = cat && cat !== "all" ? cat : null;

  const scored: { p: IndexedProduct; score: number }[] = [];
  for (const p of index.products) {
    if (category && p.categorySlug !== category) continue;
    const pool = [...p.nameWords, ...p.brandWords, ...p.otherWords];
    if (hits(tokens, pool) < tokens.length) continue; // every token must match some word
    let score = hits(tokens, p.nameWords) * 3 + hits(tokens, p.brandWords) * 2 + hits(tokens, p.otherWords);
    if (p.nameNorm.includes(qn)) score += 4;
    if (p.nameNorm.startsWith(qn)) score += 2;
    scored.push({ p, score: score + Math.min(1, p.pop / 100000) });
  }
  scored.sort((a, b) => b.score - a.score);

  const concerns = index.concerns.filter((c) => hits(tokens, c.words) === tokens.length).slice(0, 2).map(({ slug, name, emoji }) => ({ slug, name, emoji }));
  const brands = index.brands.filter((b) => hits(tokens, b.words) === tokens.length).slice(0, 2).map(({ slug, name }) => ({ slug, name }));

  return {
    q,
    sponsored,
    concerns,
    brands,
    products: scored.slice(0, 5).map((s) => strip(s.p)),
    trending: index.trending,
  };
}
