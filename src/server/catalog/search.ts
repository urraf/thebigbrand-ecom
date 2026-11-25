import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import type { ProductCardData } from "@/types/shared";
import {
  DEALS_MIN_OFF,
  DISCOUNT_STEPS,
  PAGE_SIZE,
  PRICE_RANGES,
  RATING_STEPS,
  SORT_KEYS,
  emptyState,
  type SearchMode,
  type SearchState,
  type SortKey,
} from "@/components/catalog/search-state";
import { getCatalog, getStoreSettings, type CatalogEntry, type CatalogSnapshot } from "./data";
import { norm, queryTokens, stem, SYN } from "./text";

/**
 * CATALOGUE SEARCH — tokenised, case/diacritic-insensitive matching over product name, brand, category, tags and
 * concern names; ranked by match quality, then popularity. Filters, facets (counts that ignore their own
 * group, like every big marketplace), sorting and pagination run in memory over the cached catalogue
 * snapshot; each distinct query+filters combination is itself cached ('use cache', tagged products…).
 * Shared by /s, /c/[slug], /deals, GET /api/v1/search and GET /api/v1/catalog/products.
 */

// ───────────────────────────── params (zod) ─────────────────────────────

const csvList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) =>
    (Array.isArray(v) ? v.join(",") : v)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9-]{1,60}$/.test(s)),
  )
  .transform((a) => [...new Set(a)].slice(0, 20));
const one = <T extends z.ZodType>(s: T) => z.preprocess((v) => (Array.isArray(v) ? v[0] : v), s);
const money = one(z.coerce.number().int().min(0).max(1_000_000));

export const searchParamsSchema = z.object({
  q: one(z.string().trim().max(120)).transform((s) => s.replace(/\s+/g, " ").slice(0, 80)),
  cat: one(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{0,60}$/)),
  brand: csvList,
  concern: csvList,
  min: money,
  max: money,
  rating: one(z.coerce.number().min(0).max(5)),
  discount: one(z.coerce.number().int().min(0).max(90)),
  gift: one(z.enum(["1", "0", "true", "false"])).transform((v) => v === "1" || v === "true"),
  stock: one(z.enum(["1", "0", "true", "false"])).transform((v) => v === "1" || v === "true"),
  sort: one(z.enum(SORT_KEYS as [SortKey, ...SortKey[]])),
  page: one(z.coerce.number().int().min(1).max(500)),
  limit: one(z.coerce.number().int().min(1).max(100)),
});
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Lenient parse for pages (a bad value is ignored, never a 400): each field is validated on its own.
 * `strict` (API) throws a ZodError on the first invalid field instead.
 */
export function parseSearchState(raw: RawSearchParams, mode: SearchMode, opts: { cat?: string; strict?: boolean } = {}): SearchState & { limit: number } {
  const shape = searchParamsSchema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const v = raw[key];
    if (v === undefined || v === "") continue;
    const r = shape[key].safeParse(v);
    if (r.success) out[key] = r.data;
    else if (opts.strict) throw new z.ZodError(r.error.issues.map((i) => ({ ...i, path: [key, ...i.path] })));
  }
  const st = emptyState(mode, mode === "c" ? (opts.cat ?? "") : ((out.cat as string) ?? ""));
  st.q = (out.q as string) ?? "";
  st.brands = (out.brand as string[]) ?? [];
  st.concerns = (out.concern as string[]) ?? [];
  let min = (out.min as number) ?? 0;
  let max = (out.max as number) ?? 0;
  if (min && max && min > max) [min, max] = [max, min];
  st.min = min;
  st.max = max;
  st.rating = (out.rating as number) ?? 0;
  st.discount = (out.discount as number) ?? 0;
  st.gift = (out.gift as boolean) ?? false;
  st.stock = (out.stock as boolean) ?? false;
  st.sort = (out.sort as SortKey) ?? "rel";
  st.page = (out.page as number) ?? 1;
  return { ...st, limit: (out.limit as number) ?? PAGE_SIZE };
}

// ───────────────────────────── matching ─────────────────────────────

type FieldKey = keyof CatalogEntry["idx"];
const WEIGHTS: [FieldKey, number][] = [
  ["name", 3],
  ["brand", 3],
  ["cat", 2],
  ["concern", 1.6],
  ["tag", 1.4],
  ["extra", 0.6],
];

function wordQuality(fieldWords: string[], t: string): number {
  if (t.includes(" ")) {
    const joined = ` ${fieldWords.join(" ")} `;
    return joined.includes(` ${t} `) ? 1 : 0;
  }
  const st = stem(t);
  let best = 0;
  for (const w of fieldWords) {
    if (w === t || stem(w) === st) return 1;
    if (t.length >= 2 && w.startsWith(t)) best = Math.max(best, t.length >= 3 ? 0.85 : 0.6);
    else if (t.length >= 4 && w.includes(t)) best = Math.max(best, 0.55);
    else if (w.length >= 4 && t.length > w.length && t.startsWith(w) && w.length / t.length >= 0.7) best = Math.max(best, 0.6); // "moisturisers" ~ "moisturiser"
  }
  return best;
}

function tokenScore(e: CatalogEntry, t: string): number {
  const alts: [string, number][] = [[t, 1], ...(SYN[t] ?? SYN[stem(t)] ?? []).map((a): [string, number] => [norm(a), 0.8])];
  let best = 0;
  for (const [field, w] of WEIGHTS) {
    const words = e.idx[field];
    if (!words.length) continue;
    for (const [alt, f] of alts) {
      const q = wordQuality(words, alt);
      if (q) best = Math.max(best, w * q * f);
    }
  }
  return best;
}

type Scored = { e: CatalogEntry; score: number };

function scoreQuery(entries: CatalogEntry[], q: string): { scored: Scored[]; loose: boolean; tokens: string[] } {
  const tokens = queryTokens(q);
  const nq = norm(q);
  if (!tokens.length) return { scored: entries.map((e) => ({ e, score: 0 })), loose: false, tokens };
  const run = (minHits: number) => {
    const out: Scored[] = [];
    for (const e of entries) {
      let sum = 0;
      let hits = 0;
      for (const t of tokens) {
        const s = tokenScore(e, t);
        if (s) {
          sum += s;
          hits++;
        }
      }
      if (hits >= minHits) {
        let bonus = 0;
        if (nq.length >= 3 && e.phrase.includes(nq)) bonus += 3;
        if (nq.includes(" ") && e.tagPhrases.some((tp) => tp === nq || tp.includes(nq))) bonus += 2;
        out.push({ e, score: sum / tokens.length + bonus + (hits === tokens.length ? 1 : 0) });
      }
    }
    return out;
  };
  let scored = run(tokens.length);
  let loose = false;
  if (!scored.length && tokens.length > 1) {
    scored = run(Math.ceil(tokens.length / 2));
    if (!scored.length) scored = run(1);
    loose = scored.length > 0;
  }
  return { scored, loose, tokens };
}

// ───────────────────────────── filters + facets ─────────────────────────────

type FilterKey = "cat" | "brand" | "concern" | "price" | "rating" | "discount" | "stock";

function priceIn(price: number, min: number, max: number) {
  return (!min || price >= min) && (!max || price <= max);
}

function passes(e: CatalogEntry, st: SearchState, except?: FilterKey): boolean {
  const c = e.card;
  if (except !== "cat" && st.cat && c.categorySlug !== st.cat) return false;
  if (except !== "brand" && st.brands.length && !st.brands.includes(c.brand.slug)) return false;
  if (except !== "concern" && st.concerns.length && !st.concerns.some((x) => e.concerns.includes(x))) return false;
  if (except !== "price" && !priceIn(c.price, st.min, st.max)) return false;
  if (except !== "rating" && st.rating && c.rating < st.rating) return false;
  if (except !== "discount" && st.discount && e.off < st.discount) return false;
  if (except !== "stock" && (st.stock || st.gift) && c.stock <= 0) return false;
  return true;
}

export type Facets = {
  categories: { slug: string; name: string; count: number }[];
  brands: { slug: string; name: string; count: number; isOwn: boolean }[];
  concerns: { slug: string; name: string; emoji: string | null; count: number }[];
  price: { min: number; max: number; label: string; count: number }[];
  rating: { value: number; count: number }[];
  discount: { value: number; count: number }[];
  inStock: number;
};

function computeFacets(base: Scored[], st: SearchState, snap: CatalogSnapshot): Facets {
  const g = (k: FilterKey) => base.filter((x) => passes(x.e, st, k));
  const tally = (list: Scored[], keys: (e: CatalogEntry) => string[]) => {
    const m = new Map<string, number>();
    for (const x of list) for (const k of keys(x.e)) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const cat = tally(g("cat"), (e) => [e.card.categorySlug]);
  const brand = tally(g("brand"), (e) => [e.card.brand.slug]);
  const concern = tally(g("concern"), (e) => e.concerns);
  const pr = g("price");
  const rt = g("rating");
  const ds = g("discount");
  return {
    categories: snap.categories.filter((c) => cat.get(c.slug) || st.cat === c.slug).map((c) => ({ slug: c.slug, name: c.name, count: cat.get(c.slug) ?? 0 })),
    brands: snap.brands
      .filter((b) => brand.get(b.slug) || st.brands.includes(b.slug))
      .map((b) => ({ slug: b.slug, name: b.displayName, count: brand.get(b.slug) ?? 0, isOwn: b.isOwn }))
      .sort((a, b) => Number(st.brands.includes(b.slug)) - Number(st.brands.includes(a.slug)) || b.count - a.count || a.name.localeCompare(b.name)),
    concerns: snap.concerns.filter((c) => concern.get(c.slug) || st.concerns.includes(c.slug)).map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji, count: concern.get(c.slug) ?? 0 })),
    price: PRICE_RANGES.map((r) => ({ ...r, count: pr.filter((x) => priceIn(x.e.card.price, r.min, r.max)).length })),
    rating: RATING_STEPS.map((v) => ({ value: v, count: rt.filter((x) => x.e.card.rating >= v).length })),
    discount: DISCOUNT_STEPS.map((v) => ({ value: v, count: ds.filter((x) => x.e.off >= v).length })),
    inStock: base.filter((x) => passes(x.e, st, "stock") && x.e.card.stock > 0).length,
  };
}

function comparator(st: SearchState): (a: Scored, b: Scored) => number {
  const pop = (a: Scored, b: Scored) => b.e.pop - a.e.pop;
  const tier = (s: number) => Math.round(s * 2) / 2;
  switch (st.sort) {
    case "best":
      return (a, b) => b.e.card.soldCount - a.e.card.soldCount || pop(a, b);
    case "new":
      return (a, b) => b.e.createdAt - a.e.createdAt || pop(a, b);
    case "price-asc":
      return (a, b) => a.e.card.price - b.e.card.price || pop(a, b);
    case "price-desc":
      return (a, b) => b.e.card.price - a.e.card.price || pop(a, b);
    case "rating":
      return (a, b) => b.e.card.rating - a.e.card.rating || b.e.card.reviewCount - a.e.card.reviewCount;
    case "discount":
      return (a, b) => b.e.off - a.e.off || pop(a, b);
    default:
      if (st.q) return (a, b) => tier(b.score) - tier(a.score) || pop(a, b);
      if (st.mode === "deals") return (a, b) => b.e.off - a.e.off || pop(a, b);
      // featured: in-stock first, then popularity
      return (a, b) => Number(b.e.card.stock > 0) - Number(a.e.card.stock > 0) || pop(a, b);
  }
}

// ───────────────────────────── the cached search ─────────────────────────────

export type SearchCore = {
  /** every matching product id, in display order */
  ids: string[];
  /** matches before filters (for "no results with these filters" vs "no results at all") */
  baseTotal: number;
  facets: Facets;
  loose: boolean;
  /** brand whose name the query matches ("loreal" → L'Oréal Paris) */
  brandMatch: { slug: string; name: string } | null;
  related: string[];
};

/** The state fields that change results (page/limit excluded so pages share one cache entry). */
export function searchKey(st: SearchState) {
  return {
    mode: st.mode,
    q: st.q,
    cat: st.cat,
    brands: [...st.brands].sort(),
    concerns: [...st.concerns].sort(),
    min: st.min,
    max: st.max,
    rating: st.rating,
    discount: st.discount,
    gift: st.gift,
    stock: st.stock,
    sort: st.sort,
  };
}
type SearchKey = ReturnType<typeof searchKey>;

async function runSearch(key: SearchKey): Promise<SearchCore> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.brands, TAGS.categories, TAGS.concerns, TAGS.settings);
  const st: SearchState = { ...emptyState(key.mode), ...key, page: 1 };
  const [snap, settings] = await Promise.all([getCatalog(), getStoreSettings()]);
  const { scored, loose } = scoreQuery(snap.entries, st.q);
  let base = scored;
  if (st.mode === "deals") base = base.filter((x) => x.e.off >= DEALS_MIN_OFF);
  const items = base.filter((x) => passes(x.e, st)).sort(comparator(st));
  const nq = norm(st.q);
  const bm = nq ? snap.brands.find((b) => !b.isOwn && b.productCount > 0 && [norm(b.name), norm(b.word), b.slug].includes(nq)) : undefined;
  return {
    ids: items.map((x) => x.e.card.id),
    baseTotal: base.length,
    facets: computeFacets(base, st, snap),
    loose,
    brandMatch: bm ? { slug: bm.slug, name: bm.name } : null,
    related: relatedSearches(st, base, snap, settings.trending),
  };
}

function relatedSearches(st: SearchState, base: Scored[], snap: CatalogSnapshot, trending: string[]): string[] {
  if (!st.q) return [];
  const nq = norm(st.q);
  const toks = queryTokens(st.q).map(stem);
  const out: string[] = [];
  const add = (s: string) => {
    const v = s.toLowerCase();
    if (norm(v) !== nq && !out.includes(v)) out.push(v);
  };
  trending.forEach((t) => {
    if (toks.some((k) => k.length > 2 && norm(t).includes(k))) add(t);
  });
  const cc = new Map<string, number>();
  base.forEach((x) => x.e.concerns.forEach((c) => cc.set(c, (cc.get(c) ?? 0) + 1)));
  [...cc.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .forEach(([c]) => {
      const n = snap.concerns.find((x) => x.slug === c)?.name;
      if (n) add(n);
    });
  const bc = new Map<string, number>();
  base.forEach((x) => {
    if (!x.e.card.brand.isOwn) bc.set(x.e.card.brand.name, (bc.get(x.e.card.brand.name) ?? 0) + 1);
  });
  [...bc.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .forEach(([b]) => {
      if (!norm(st.q).includes(norm(b))) add(`${b} ${st.q}`);
    });
  return out.slice(0, 6);
}

export type SearchPage = SearchCore & {
  state: SearchState;
  total: number;
  page: number;
  pages: number;
  limit: number;
  from: number;
  to: number;
  items: ProductCardData[];
  /** ids placed first on page 1 (sponsored products that also match the search) */
  pinned: string[];
};

/** How many sponsored products a results page carries (none on tiny result sets). */
export const sponsoredCount = (total: number) => (total >= 16 ? 4 : total >= 8 ? 3 : total >= 4 ? 2 : 0);

/**
 * Search + paginate. `pin` puts product ids first on page 1 (sponsored products that also match, at most
 * sponsoredCount(total)), and keeps them out of later pages so nothing repeats. Pass the same `pin` on every page.
 */
export async function searchCatalog(st: SearchState, opts: { limit?: number; pin?: string[] } = {}): Promise<SearchPage> {
  const limit = opts.limit ?? PAGE_SIZE;
  const [core, snap] = await Promise.all([runSearch(searchKey(st)), getCatalog()]);
  const inResults = new Set(core.ids);
  const pinned = [...new Set(opts.pin ?? [])].filter((id) => inResults.has(id)).slice(0, sponsoredCount(core.ids.length));
  const pinSet = new Set(pinned);
  const ordered = pinned.length ? [...pinned, ...core.ids.filter((id) => !pinSet.has(id))] : core.ids;
  const total = ordered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, st.page), pages);
  const slice = ordered.slice((page - 1) * limit, page * limit);
  const byId = new Map(snap.entries.map((e) => [e.card.id, e.card]));
  return {
    ...core,
    state: { ...st, page },
    total,
    page,
    pages,
    limit,
    from: total ? (page - 1) * limit + 1 : 0,
    to: Math.min(total, page * limit),
    items: slice.map((id) => byId.get(id)).filter((c): c is ProductCardData => !!c),
    pinned,
  };
}

/** Top products for empty states, rails etc. (cached snapshot, no query). */
export async function topProducts(opts: { limit?: number; categorySlug?: string; excludeIds?: string[]; ownLabel?: boolean } = {}): Promise<ProductCardData[]> {
  const snap = await getCatalog();
  const ex = new Set(opts.excludeIds ?? []);
  return snap.entries
    .filter((e) => !ex.has(e.card.id) && e.card.stock > 0 && (!opts.categorySlug || e.card.categorySlug === opts.categorySlug) && (opts.ownLabel === undefined || e.card.isOwnLabel === opts.ownLabel))
    .sort((a, b) => b.pop - a.pop)
    .slice(0, opts.limit ?? 8)
    .map((e) => e.card);
}

// ───────────────────────────── analytics ─────────────────────────────

const recentLogs = new Map<string, number>();

/** Record a search for the admin's "top searches" (fire-and-forget; never throws). Duplicate renders of the same
 * request (streaming + RSC refetch) within a few seconds are counted once. */
export async function logSearch(q: string, results: number, userId: string | null): Promise<void> {
  const text = q.trim().replace(/\s+/g, " ").slice(0, 80);
  if (text.length < 2) return;
  const key = `${userId ?? "-"}|${text.toLowerCase()}|${results}`;
  const now = Date.now();
  if (now - (recentLogs.get(key) ?? 0) < 4000) return;
  recentLogs.set(key, now);
  if (recentLogs.size > 5000) for (const [k, t] of recentLogs) if (now - t > 4000) recentLogs.delete(k);
  try {
    await db.searchQuery.create({ data: { q: text.toLowerCase(), results: Math.max(0, Math.round(results)), userId } });
  } catch (e) {
    console.error("[search] log failed", e);
  }
}
