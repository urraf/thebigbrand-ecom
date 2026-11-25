import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import type { ReactNode } from "react";
import { AdZone, SponsoredCard } from "@/components/ads";
import { ProductCard } from "@/components/ui/product-card";
import { Icon } from "@/components/ui/icon";
import { formatINR } from "@/lib/money";
import { getServedAds } from "@/server/ads/serve";
import { getZoneSlot } from "@/server/ads/slots";
import { getCatalog, getStoreSettings } from "@/server/catalog/data";
import { getGiftProgramme } from "@/server/catalog/offers";
import { getCategoryHead, getCategoryTiles, getConcernHead, getDealsHead } from "@/server/catalog/pages";
import { logSearch, parseSearchState, searchCatalog, type RawSearchParams } from "@/server/catalog/search";
import { adContextFor, sponsoredForSearch } from "@/server/catalog/sponsored";
import { Art } from "@/components/catalog/visual";
import { FilterButton, FilterSidebar, SortSelect } from "./filters";
import { CategoryHeader, ConcernHeader, DealsHeader } from "./heads";
import { clearedState, hrefFor, patchHref, priceLabel, type SearchMode, type SearchState } from "../search-state";

const plural = (n: number, w: string) => `${n.toLocaleString("en-IN")} ${w}${n === 1 ? "" : "s"}`;
const GRID_SIZES = "(max-width: 700px) 46vw, (max-width: 1280px) 30vw, 260px";

type Chip = { label: string; href: string };

function activeChips(st: SearchState, names: { cat: Map<string, string>; brand: Map<string, string>; concern: Map<string, string> }): Chip[] {
  const out: Chip[] = [];
  if (st.cat && st.mode !== "c") out.push({ label: names.cat.get(st.cat) ?? st.cat, href: patchHref(st, { cat: "" }) });
  st.brands.forEach((b) => out.push({ label: names.brand.get(b) ?? b, href: patchHref(st, { brands: st.brands.filter((x) => x !== b) }) }));
  st.concerns.forEach((c) => out.push({ label: names.concern.get(c) ?? c, href: patchHref(st, { concerns: st.concerns.filter((x) => x !== c) }) }));
  if (st.min || st.max) out.push({ label: priceLabel(st.min, st.max), href: patchHref(st, { min: 0, max: 0 }) });
  if (st.rating) out.push({ label: `${st.rating}★ & up`, href: patchHref(st, { rating: 0 }) });
  if (st.discount) out.push({ label: `${st.discount}% off or more`, href: patchHref(st, { discount: 0 }) });
  if (st.gift) out.push({ label: "Free gift eligible", href: patchHref(st, { gift: false }) });
  if (st.stock) out.push({ label: "In stock", href: patchHref(st, { stock: false }) });
  return out;
}

/**
 * Marketplace results for /s, /c/[slug] and /deals — reads searchParams, so it renders inside <Suspense>.
 * Search + facets come from the cached catalogue search; S3 sponsored products that also match the search are
 * pinned first on page 1 ("Sponsored" + tracked link), S2 headline above, S4 native tile at position 7.
 */
export async function Results({ mode, searchParams, cat }: { mode: SearchMode; searchParams: Promise<RawSearchParams>; cat?: string }) {
  const raw = await searchParams;
  const st = parseSearchState(raw, mode, { cat });
  const snap = await getCatalog();
  if (mode === "c" && !snap.categories.some((c) => c.slug === st.cat)) notFound();

  const concernLanding = mode === "s" && !st.q && !st.cat && !st.brands.length && st.concerns.length === 1;
  const ctx = adContextFor(st);
  const [sp, s3Slot, s4Ads, programme, settings, catHead, conHead, dealsHead, tiles] = await Promise.all([
    sponsoredForSearch(st),
    getZoneSlot("S3"),
    getServedAds("S4", ctx),
    getGiftProgramme(),
    getStoreSettings(),
    mode === "c" ? getCategoryHead(st.cat) : null,
    concernLanding ? getConcernHead(st.concerns[0]) : null,
    mode === "deals" ? getDealsHead() : null,
    getCategoryTiles(),
  ]);
  const s3On = Boolean(s3Slot?.isActive);
  const res = await searchCatalog(st, { pin: s3On ? sp.map((x) => x.product.id) : [] });
  const state = res.state;

  if (state.q && res.page === 1) {
    const { q } = state;
    const total = res.total;
    // analytics only for real requests (never during prerender / prefetch / dev validation renders)
    await connection();
    after(() => logSearch(q, total, null));
  }

  const names = {
    cat: new Map(snap.categories.map((c) => [c.slug, c.name])),
    brand: new Map(snap.brands.map((b) => [b.slug, b.displayName])),
    concern: new Map(snap.concerns.map((c) => [c.slug, c.name])),
  };
  const N = res.total;
  const chips = activeChips(state, names);
  const showSide = res.baseTotal > 0;
  const noun = mode === "deals" ? (N === 1 ? "deal" : "deals") : N === 1 ? "result" : "results";
  const sortName = state.sort === "best" ? "Bestsellers" : state.sort === "new" ? "New arrivals" : null;
  let context: ReactNode;
  if (state.q) context = <>for <q>{state.q}</q></>;
  else if (mode === "c") context = <>in <b>{names.cat.get(state.cat)}</b></>;
  else if (mode === "deals") context = state.cat ? <>in <b>{names.cat.get(state.cat)}</b></> : "live today";
  else if (state.concerns.length === 1) context = <>for <b>{names.concern.get(state.concerns[0])}</b></>;
  else if (state.brands.length === 1) context = <>from <b>{names.brand.get(state.brands[0])}</b></>;
  else if (state.cat) context = <>in <b>{names.cat.get(state.cat)}</b></>;
  else if (sortName) context = <>in <b>{sortName}</b></>;
  else context = "across all brands";
  const CountTag = mode === "s" && !conHead ? "h1" : "p";

  // ── grid cells ──
  const pinned = new Set(res.page === 1 ? res.pinned : []);
  const cells: ReactNode[] = res.items.map((p, i) => {
    const s = pinned.has(p.id) ? sp.find((x) => x.product.id === p.id) : undefined;
    if (s && s3Slot) return <SponsoredCard key={`sp-${p.id}`} ad={s.ad} product={p} slot={s3Slot} sizes={GRID_SIZES} />;
    return <ProductCard key={p.id} product={p} sizes={GRID_SIZES} priority={i < 4} />;
  });
  const hasS4 = res.page === 1 && N > 0 && s4Ads.length > 0;
  const s4 = hasS4 ? <AdZone key="s4" code="S4" context={ctx} /> : null;
  let s4Placed = false;
  if (s4 && cells.length >= 7) {
    cells.splice(6, 0, s4);
    s4Placed = true;
  }
  const small = N > 0 && N < 8;
  if (s4 && !s4Placed && !small && cells.length >= 3) {
    cells.push(s4);
    s4Placed = true;
  }

  const pager =
    res.pages > 1 ? (
      <nav className="sr-pager" aria-label="Results pages">
        {res.page > 1 ? (
          <Link href={hrefFor({ ...state, page: res.page - 1 })} rel="prev">
            <Icon name="chevLeft" />
            <span>Previous</span>
          </Link>
        ) : (
          <span className="is-off" aria-hidden="true">
            <Icon name="chevLeft" />
            <span>Previous</span>
          </span>
        )}
        {Array.from({ length: res.pages }, (_, i) => i + 1).map((n) => (
          <Link key={n} href={hrefFor({ ...state, page: n })} aria-current={n === res.page ? "page" : undefined} aria-label={`Page ${n}`}>
            {n}
          </Link>
        ))}
        {res.page < res.pages ? (
          <Link href={hrefFor({ ...state, page: res.page + 1 })} rel="next">
            <span>Next</span>
            <Icon name="chevRight" />
          </Link>
        ) : (
          <span className="is-off" aria-hidden="true">
            <span>Next</span>
            <Icon name="chevRight" />
          </span>
        )}
      </nav>
    ) : null;

  const giftTiers = programme.tiers.filter((t) => t.minAmount > 0);

  return (
    <div className={`sr-page sr-results sr-mode-${mode}`}>
      {catHead ? <CategoryHeader head={catHead} state={state} /> : null}
      {dealsHead ? <DealsHeader head={dealsHead} state={state} /> : null}
      {conHead ? <ConcernHeader head={conHead} /> : null}
      <div className="wrap">
        <div className="sr-bar">
          <div className="sr-bar-t">
            <CountTag className="sr-count">
              {N ? (
                <>
                  <b>
                    {res.from}–{res.to}
                  </b>{" "}
                  of <b>{N.toLocaleString("en-IN")}</b> {noun} {context}
                </>
              ) : (
                <>
                  <b>0</b> {noun} {context}
                </>
              )}
            </CountTag>
            {res.loose && N ? <p className="sr-loose">No exact match for all the words — showing the closest results.</p> : null}
          </div>
          {res.related.length ? (
            <nav className="sr-rel" aria-label="Related searches">
              <span>Related:</span>
              {res.related.map((r) => (
                <Link key={r} href={`/s?q=${encodeURIComponent(r)}`} prefetch={false}>
                  {r}
                </Link>
              ))}
            </nav>
          ) : (
            <span className="sr-bar-sp" />
          )}
          {N ? <SortSelect state={state} id="sr-sort-d" /> : null}
        </div>
        {showSide ? (
          <div className="sr-mctl">
            <FilterButton active={chips.length} />
            <SortSelect state={state} id="sr-sort-m" mobile />
          </div>
        ) : null}
        <div className={showSide ? "sr-layout" : "sr-layout no-side"}>
          {showSide ? <FilterSidebar key={hrefFor(state)} state={state} facets={res.facets} total={N} /> : null}
          <div className="sr-main">
            {N || res.baseTotal ? <AdZone code="S2" context={ctx} /> : null}
            {res.brandMatch && !state.brands.length ? (
              <Link className="sr-storelink" href={`/brand/${res.brandMatch.slug}`}>
                <Icon name="store" />
                <span>
                  Visit the official <b>{res.brandMatch.name}</b> store
                </span>
                <Icon name="arrow" />
              </Link>
            ) : null}
            {chips.length ? (
              <div className="sr-active" aria-label="Active filters">
                {chips.map((c) => (
                  <Link key={c.href + c.label} className="sr-chip" href={c.href} scroll={false} aria-label={`Remove filter ${c.label}`}>
                    {c.label}
                    <Icon name="close" />
                  </Link>
                ))}
                <Link className="sr-clearall" href={hrefFor(clearedState(state))} scroll={false}>
                  Clear all
                </Link>
              </div>
            ) : null}
            {state.gift && N ? (
              <div className="sr-giftnote">
                <Icon name="gift" />
                <span>
                  <b>All {plural(N, "result")} qualify for a free TBB mini.</b> Pick it at checkout, before you pay
                  {giftTiers.length ? ` — ${giftTiers.map((t) => `${t.giftCount} gifts on ${formatINR(t.minAmount)}+`).join(", ")}` : ""}.
                </span>
                <Link className="link" href="/gifts">
                  See gifts
                </Link>
              </div>
            ) : null}
            {N ? (
              <>
                <div className="sr-gh">
                  <h2>{mode === "deals" ? "Deals" : "Results"}</h2>
                  <span>Prices include GST · {mode === "deals" ? "while stocks last" : "sponsored listings are marked"}</span>
                </div>
                <div className="sr-grid">{cells}</div>
                {pager}
                {small && s3On ? (
                  <div className="sr-also">
                    {s4 && !s4Placed ? <div className="sr-also-s4">{s4}</div> : null}
                    <AdZone code="S3" context={{ ...ctx, excludeProductIds: res.items.map((p) => p.id) }} variant="grid" title="Customers also considered" subtitle="Sponsored picks from brand partners" />
                  </div>
                ) : null}
              </>
            ) : res.baseTotal ? (
              <div className="sr-empty blk">
                <div className="sr-empty-ic">
                  <Icon name="filter" />
                </div>
                <h2>No products match these filters</h2>
                <p>There are {plural(res.baseTotal, "result")} without them — try removing a filter or two.</p>
                <Link className="btn btn-cart" href={hrefFor(clearedState(state))} scroll={false}>
                  Clear all filters
                </Link>
              </div>
            ) : (
              <>
                <div className="sr-empty blk">
                  <svg className="sr-empty-art" viewBox="0 0 160 120" aria-hidden="true">
                    <circle cx="70" cy="56" r="34" fill="#fff0f3" stroke="#ff3d6e" strokeWidth="6" />
                    <path d="M95 82l26 26" stroke="#140a24" strokeWidth="10" strokeLinecap="round" />
                    <path d="M58 50h24M58 62h16" stroke="#ffb3c4" strokeWidth="5" strokeLinecap="round" />
                    <path d="M128 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#ffb347" />
                    <path d="M24 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#5b35e0" />
                  </svg>
                  <h2>{state.q ? <>No results for &ldquo;{state.q}&rdquo;</> : "Nothing here yet"}</h2>
                  <p>Check the spelling, try a more general word — or start with what India is searching for:</p>
                  <div className="sr-empty-chips">
                    {settings.trending.map((t) => (
                      <Link key={t} className="chip" href={`/s?q=${encodeURIComponent(t)}`} prefetch={false}>
                        <Icon name="trending" />
                        {t}
                      </Link>
                    ))}
                  </div>
                  <div className="sr-empty-cats">
                    {tiles.map((c) => (
                      <Link key={c.slug} href={`/c/${c.slug}`} prefetch={false}>
                        <span className="sr-ec-art">
                          {c.imageUrl ? <Image src={c.imageUrl} alt="" fill sizes="80px" /> : c.top ? <Art product={c.top} sizes="80px" /> : null}
                        </span>
                        <span>{c.short}</span>
                      </Link>
                    ))}
                  </div>
                </div>
                {s3On ? <AdZone code="S3" context={{ categorySlug: state.cat || undefined }} variant="grid" title="Popular right now" subtitle="Sponsored picks from brand partners" /> : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Suspense fallback: the results frame with shimmering cards (no layout shift when results stream in). */
export function ResultsSkeleton({ mode }: { mode: SearchMode }) {
  return (
    <div className={`sr-page sr-results sr-mode-${mode}`} aria-busy="true" aria-label="Loading results">
      {mode !== "s" ? (
        <div className="wrap">
          <div className="ct-sk sr-sk-head" />
        </div>
      ) : null}
      <div className="wrap">
        <div className="ct-sk sr-sk-bar" />
        <div className="sr-layout">
          <div className="ct-sk sr-sk-side" />
          <div className="sr-main">
            <div className="sr-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="ct-sk sr-sk-card" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
