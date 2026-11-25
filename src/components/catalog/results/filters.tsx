"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Stars } from "@/components/ui/stars";
import { cx } from "@/components/ui/cx";
import { PRICE_RANGES, SORTS, clearedState, hrefFor, toParams, type SearchState, type SortKey } from "../search-state";

/**
 * Results filters (client island): the sidebar on desktop — every change navigates to the new URL right away
 * (shareable, server-rendered results) — and a bottom sheet on phones, where changes are staged and the
 * "Show N results" button (live count from GET /api/v1/catalog/products) applies them.
 */

export type FacetsView = {
  categories: { slug: string; name: string; count: number }[];
  brands: { slug: string; name: string; count: number; isOwn: boolean }[];
  concerns: { slug: string; name: string; emoji: string | null; count: number }[];
  price: { min: number; max: number; label: string; count: number }[];
  rating: { value: number; count: number }[];
  discount: { value: number; count: number }[];
};

const SHEET_EVENT = "tbb:sr-sheet";
const SHEET_MQ = "(max-width: 960px)";
const BRANDS_SHOWN = 6;

function useNavigate() {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    document.body.classList.toggle("sr-busy", pending);
    return () => document.body.classList.remove("sr-busy");
  }, [pending]);
  return (href: string) => start(() => router.push(href, { scroll: false }));
}

export function openFilterSheet() {
  window.dispatchEvent(new CustomEvent(SHEET_EVENT, { detail: true }));
}

/** Query string for the live count (category kept even on /c/<slug>). */
function countUrl(st: SearchState): string {
  const p = toParams({ ...st, page: 1 });
  if (st.cat) p.set("cat", st.cat);
  if (st.mode === "deals") p.set("deals", "1");
  p.set("limit", "1");
  p.set("sponsored", "0");
  p.delete("sort");
  return `/api/v1/catalog/products?${p.toString()}`;
}

export function FilterSidebar({ state, facets, total }: { state: SearchState; facets: FacetsView; total: number }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(state);
  const [open, setOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [count, setCount] = useState<number | null>(total);
  const closeRef = useRef<HTMLButtonElement>(null);
  const priceMin = useRef<HTMLInputElement>(null);
  const priceMax = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => {
      setDraft(state);
      setCount(total);
      setOpen(true);
    };
    window.addEventListener(SHEET_EVENT, onOpen);
    return () => window.removeEventListener(SHEET_EVENT, onOpen);
  }, [state, total]);

  useEffect(() => {
    document.body.classList.toggle("sr-sheet-open", open);
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia(SHEET_MQ);
    const onMq = () => !mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.classList.remove("sr-sheet-open");
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  // live result count while the sheet is open
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(countUrl(draft), { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { data?: { total?: number } } | null) => setCount(j?.data?.total ?? null))
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [draft, open]);

  const apply = (next: SearchState) => {
    const n = { ...next, page: 1 };
    setDraft(n);
    if (!open) navigate(hrefFor(n)); // phones: staged until "Show N results"
  };

  const st = draft;
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const priceSel = PRICE_RANGES.findIndex((r) => r.min === st.min && r.max === st.max);

  const onPriceGo = (e: FormEvent) => {
    e.preventDefault();
    let min = Math.max(0, Math.round(Number(priceMin.current?.value) || 0));
    let max = Math.max(0, Math.round(Number(priceMax.current?.value) || 0));
    if (min && max && min > max) [min, max] = [max, min];
    apply({ ...st, min, max });
  };

  const brands = facets.brands;
  const group = (id: string, title: string, active: boolean, onClear: () => void, body: React.ReactNode) => (
    <fieldset className="sr-g" data-g={id}>
      <legend className="sr-g-h">
        <span>{title}</span>
      </legend>
      {active ? (
        <button type="button" className="sr-g-clear" onClick={onClear}>
          Clear
        </button>
      ) : null}
      {body}
    </fieldset>
  );
  const opt = (k: string, type: "radio" | "checkbox", name: string, label: React.ReactNode, count: number | null, checked: boolean, onChange: () => void, extraCls?: string) => (
    <label key={k} className={cx("sr-opt", type === "radio" && "is-radio", count === 0 && !checked && "is-zero", extraCls)}>
      <input type={type} name={name} checked={checked} onChange={onChange} />
      <span className="sr-box" aria-hidden="true">
        <Icon name="check" />
      </span>
      <span className="sr-opt-l">{label}</span>
      {count != null ? <span className="sr-opt-n">{count}</span> : null}
    </label>
  );

  return (
    <>
      <aside className={cx("sr-side", open && "is-open")} id="sr-side" aria-label="Filters" role={open ? "dialog" : undefined} aria-modal={open || undefined}>
        <div className="sr-sheet-h">
          <b>Filters</b>
          <span className="sr-sheet-sub">{count == null ? "…" : `${count.toLocaleString("en-IN")} result${count === 1 ? "" : "s"}`}</span>
          <button type="button" className="ib-sm" aria-label="Close filters" onClick={() => setOpen(false)} ref={closeRef}>
            <Icon name="close" />
          </button>
        </div>
        <div className={cx("sr-form", brandsOpen && "brands-open")}>
          <label className="sr-giftsw">
            <span className="sr-giftsw-ic">
              <Icon name="gift" />
            </span>
            <span className="sr-giftsw-t">
              <b>Free gift eligible</b>
              <small>
                Every in-stock item qualifies — pick a TBB mini before you pay
              </small>
            </span>
            <input type="checkbox" role="switch" checked={st.gift} onChange={() => apply({ ...st, gift: !st.gift })} />
            <span className="sr-switch" aria-hidden="true" />
          </label>

          {st.mode !== "c"
            ? group(
                "cat",
                "Category",
                Boolean(st.cat),
                () => apply({ ...st, cat: "" }),
                <>
                  {opt("all", "radio", "cat", "All categories", null, !st.cat, () => apply({ ...st, cat: "" }))}
                  {facets.categories.map((c) => opt(c.slug, "radio", "cat", c.name, c.count, st.cat === c.slug, () => apply({ ...st, cat: c.slug })))}
                </>,
              )
            : null}

          {facets.concerns.length
            ? group(
                "concern",
                "Shop by concern",
                st.concerns.length > 0,
                () => apply({ ...st, concerns: [] }),
                <div className="sr-pills">
                  {facets.concerns.map((c) => (
                    <label className="sr-pill" key={c.slug}>
                      <input type="checkbox" checked={st.concerns.includes(c.slug)} onChange={() => apply({ ...st, concerns: toggleIn(st.concerns, c.slug) })} />
                      <span>
                        {c.emoji ? <span aria-hidden="true">{c.emoji}</span> : null} {c.name}
                        <i>{c.count}</i>
                      </span>
                    </label>
                  ))}
                </div>,
              )
            : null}

          {brands.length
            ? group(
                "brand",
                "Brand",
                st.brands.length > 0,
                () => apply({ ...st, brands: [] }),
                <>
                  {brands.map((b, i) =>
                    opt(
                      b.slug,
                      "checkbox",
                      "brand",
                      <>
                        {b.name}
                        {b.isOwn ? <em className="sr-own">Our label</em> : null}
                      </>,
                      b.count,
                      st.brands.includes(b.slug),
                      () => apply({ ...st, brands: toggleIn(st.brands, b.slug) }),
                      i >= BRANDS_SHOWN && !st.brands.includes(b.slug) ? "sr-more-row" : undefined,
                    ),
                  )}
                  {brands.length > BRANDS_SHOWN ? (
                    <button type="button" className="sr-morebtn" aria-expanded={brandsOpen} onClick={() => setBrandsOpen((v) => !v)}>
                      <Icon name="chevDown" />
                      <span>{brandsOpen ? "Show fewer" : `See all ${brands.length} brands`}</span>
                    </button>
                  ) : null}
                </>,
              )
            : null}

          {group(
            "price",
            "Price",
            Boolean(st.min || st.max),
            () => apply({ ...st, min: 0, max: 0 }),
            <>
              {facets.price.map((r, i) => opt(r.label, "radio", "price", r.label, r.count, priceSel === i, () => apply({ ...st, min: r.min, max: r.max })))}
              <form className="sr-price-c" onSubmit={onPriceGo} noValidate key={`${st.min}-${st.max}`}>
                <label className="sr-only" htmlFor="sr-min">
                  Minimum price
                </label>
                <input id="sr-min" ref={priceMin} type="number" inputMode="numeric" min={0} placeholder="₹ Min" defaultValue={st.min || ""} />
                <span aria-hidden="true">–</span>
                <label className="sr-only" htmlFor="sr-max">
                  Maximum price
                </label>
                <input id="sr-max" ref={priceMax} type="number" inputMode="numeric" min={0} placeholder="₹ Max" defaultValue={st.max || ""} />
                <button type="submit" className="sr-go">
                  Go
                </button>
              </form>
            </>,
          )}

          {group(
            "rating",
            "Customer rating",
            Boolean(st.rating),
            () => apply({ ...st, rating: 0 }),
            facets.rating.map((r) =>
              opt(
                String(r.value),
                "radio",
                "rating",
                <>
                  <Stars rating={r.value} />
                  <span>{r.value} &amp; up</span>
                </>,
                r.count,
                st.rating === r.value,
                () => apply({ ...st, rating: st.rating === r.value ? 0 : r.value }),
              ),
            ),
          )}

          {group(
            "discount",
            "Discount",
            Boolean(st.discount),
            () => apply({ ...st, discount: 0 }),
            facets.discount.map((d) => opt(String(d.value), "radio", "discount", `${d.value}% off or more`, d.count, st.discount === d.value, () => apply({ ...st, discount: st.discount === d.value ? 0 : d.value }))),
          )}

          {group(
            "stock",
            "Availability",
            st.stock,
            () => apply({ ...st, stock: false }),
            opt("stock", "checkbox", "stock", "In stock only", null, st.stock, () => apply({ ...st, stock: !st.stock })),
          )}
        </div>
        <div className="sr-sheet-f">
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(clearedState(st))}>
            Clear all
          </button>
          <button
            type="button"
            className="btn btn-cart"
            onClick={() => {
              setOpen(false);
              navigate(hrefFor({ ...draft, page: 1 }));
            }}
          >
            <span>{count == null ? "Show results" : <>Show <b>{count.toLocaleString("en-IN")}</b> result{count === 1 ? "" : "s"}</>}</span>
          </button>
        </div>
      </aside>
      <div className="sr-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
    </>
  );
}

/** Sort dropdown (results bar on desktop, sticky control row on phones). */
export function SortSelect({ state, id, mobile }: { state: SearchState; id: string; mobile?: boolean }) {
  const navigate = useNavigate();
  const select = (
    <select className="sr-sort" id={id} aria-label="Sort results" value={state.sort} onChange={(e) => navigate(hrefFor({ ...state, page: 1, sort: e.target.value as SortKey }))}>
      {SORTS.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
  if (mobile)
    return (
      <label className="sr-msort" htmlFor={id}>
        <span className="sr-only">Sort by</span>
        <Icon name="chart" />
        {select}
        <Icon name="chevDown" />
      </label>
    );
  return (
    <label className="sr-sortw" htmlFor={id}>
      <span>Sort by</span>
      {select}
      <Icon name="chevDown" />
    </label>
  );
}

export function FilterButton({ active }: { active: number }) {
  return (
    <button type="button" className="sr-fbtn" aria-controls="sr-side" aria-haspopup="dialog" onClick={openFilterSheet}>
      <Icon name="sliders" />
      <span>Filters</span>
      {active ? <i>{active}</i> : null}
    </button>
  );
}
