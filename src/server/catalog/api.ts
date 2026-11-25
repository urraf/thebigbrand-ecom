import "server-only";
import type { NextRequest } from "next/server";
import type { SearchMode } from "@/components/catalog/search-state";
import { trackedHref } from "@/components/ads/lib/links";
import { getCatalog } from "./data";
import { parseSearchState, searchCatalog, type RawSearchParams } from "./search";
import { sponsoredForSearch } from "./sponsored";

/** Shared JSON shape for GET /api/v1/search and GET /api/v1/catalog/products (mobile apps). */

export function rawParams(req: NextRequest): RawSearchParams {
  const out: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  return out;
}

export async function searchResponse(raw: RawSearchParams, opts: { mode?: SearchMode; sponsored?: boolean } = {}) {
  const deals = raw.deals === "1" || raw.deals === "true";
  const mode: SearchMode = opts.mode ?? (deals ? "deals" : "s");
  const st = parseSearchState(raw, mode, { strict: true, cat: typeof raw.cat === "string" ? raw.cat : undefined });
  if (mode === "c" && st.cat) {
    const snap = await getCatalog();
    if (!snap.categories.some((c) => c.slug === st.cat)) st.cat = "";
  }
  const sp = opts.sponsored === false ? [] : await sponsoredForSearch(st);
  const res = await searchCatalog(st, { limit: st.limit, pin: sp.map((x) => x.product.id) });
  const pinned = new Set(res.page === 1 ? res.pinned : []);
  return {
    query: {
      q: res.state.q,
      cat: res.state.cat || null,
      brand: res.state.brands,
      concern: res.state.concerns,
      min: res.state.min || null,
      max: res.state.max || null,
      rating: res.state.rating || null,
      discount: res.state.discount || null,
      gift: res.state.gift,
      stock: res.state.stock,
      sort: res.state.sort,
      deals: mode === "deals",
    },
    total: res.total,
    page: res.page,
    pages: res.pages,
    limit: res.limit,
    items: res.items.map((p) => {
      const s = pinned.has(p.id) ? sp.find((x) => x.product.id === p.id) : undefined;
      return s ? { ...p, sponsored: { campaignId: s.ad.id, slot: "S3", clickUrl: trackedHref(s.ad, `/p/${p.slug}`) } } : p;
    }),
    facets: res.facets,
    related: res.related,
    loose: res.loose,
    brandMatch: res.brandMatch,
    noResults: res.total === 0,
    noResultsBeforeFilters: res.baseTotal === 0,
  };
}
