/**
 * Search / listing state ⇄ URL (client-safe, no deps). Shared by the results pages, the filter sidebar island
 * and the API so links are shareable and identical everywhere.
 *
 *   /s?q=serum&cat=skin&brand=loreal,nivea&concern=acne&min=250&max=499&rating=4&discount=20&gift=1&stock=1&sort=best&page=2
 *   /c/<slug>?…   (category fixed by the path)      /deals?…   (≥15% off only)
 */

export const SORTS = [
  ["rel", "Featured"],
  ["best", "Bestsellers"],
  ["new", "Newest arrivals"],
  ["price-asc", "Price: Low to High"],
  ["price-desc", "Price: High to Low"],
  ["rating", "Avg. customer review"],
  ["discount", "Discount: High to Low"],
] as const;
export type SortKey = (typeof SORTS)[number][0];
export const SORT_KEYS = SORTS.map((s) => s[0]) as SortKey[];

export const PRICE_RANGES = [
  { min: 0, max: 249, label: "Under ₹250" },
  { min: 250, max: 499, label: "₹250 – ₹499" },
  { min: 500, max: 999, label: "₹500 – ₹999" },
  { min: 1000, max: 0, label: "₹1,000 & above" },
] as const;
export const RATING_STEPS = [4.5, 4] as const;
export const DISCOUNT_STEPS = [10, 15, 20, 30] as const;
export const DEALS_MIN_OFF = 15;
export const PAGE_SIZE = 24;

export type SearchMode = "s" | "c" | "deals";

export type SearchState = {
  mode: SearchMode;
  q: string;
  cat: string;
  brands: string[];
  concerns: string[];
  min: number;
  max: number;
  rating: number;
  discount: number;
  gift: boolean;
  stock: boolean;
  sort: SortKey;
  page: number;
};

export const emptyState = (mode: SearchMode = "s", cat = ""): SearchState => ({
  mode,
  q: "",
  cat,
  brands: [],
  concerns: [],
  min: 0,
  max: 0,
  rating: 0,
  discount: 0,
  gift: false,
  stock: false,
  sort: "rel",
  page: 1,
});

/** Query-string params for a state (path-implied values omitted). */
export function toParams(st: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (st.q) p.set("q", st.q);
  if (st.cat && st.mode !== "c") p.set("cat", st.cat);
  if (st.brands.length) p.set("brand", st.brands.join(","));
  if (st.concerns.length) p.set("concern", st.concerns.join(","));
  if (st.min) p.set("min", String(st.min));
  if (st.max) p.set("max", String(st.max));
  if (st.rating) p.set("rating", String(st.rating));
  if (st.discount) p.set("discount", String(st.discount));
  if (st.gift) p.set("gift", "1");
  if (st.stock) p.set("stock", "1");
  if (st.sort !== "rel") p.set("sort", st.sort);
  if (st.page > 1) p.set("page", String(st.page));
  return p;
}

export function basePath(st: Pick<SearchState, "mode" | "cat">): string {
  if (st.mode === "deals") return "/deals";
  if (st.mode === "c" && st.cat) return `/c/${st.cat}`;
  return "/s";
}

export function hrefFor(st: SearchState): string {
  const qs = toParams(st).toString().replace(/%2C/g, ",");
  return basePath(st) + (qs ? `?${qs}` : "");
}

/** href with some fields changed (page resets to 1 unless given). */
export function patchHref(st: SearchState, patch: Partial<SearchState>): string {
  return hrefFor({ ...st, page: 1, ...patch });
}

export function hasFilters(st: SearchState): boolean {
  return Boolean((st.cat && st.mode !== "c") || st.brands.length || st.concerns.length || st.min || st.max || st.rating || st.discount || st.gift || st.stock);
}

export function clearedState(st: SearchState): SearchState {
  return { ...emptyState(st.mode, st.mode === "c" ? st.cat : ""), q: st.q, sort: st.sort };
}

export function priceLabel(min: number, max: number): string {
  const r = PRICE_RANGES.find((x) => x.min === min && x.max === max);
  if (r) return r.label;
  const f = (n: number) => "₹" + n.toLocaleString("en-IN");
  if (min && max) return `${f(min)} – ${f(max)}`;
  return max ? `Up to ${f(max)}` : `${f(min)} & above`;
}
