"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatINR } from "@/lib/money";
import type { SuggestResult } from "@/server/search/suggest";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/ui/product-image";
import { PzBadge, SlotTag } from "@/components/ui/pz-slot";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import type { ChromeCategory } from "./nav-data";

/* ───────── recent searches (localStorage) ───────── */
const RECENT_KEY = "tbb_recent";
const RECENT_EVENT = "tbb:recent";
const subscribeRecent = (cb: () => void) => {
  window.addEventListener(RECENT_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(RECENT_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const readRecent = () => {
  try {
    return localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
};
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(RECENT_EVENT));
}
function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bold the parts of `text` that match the typed words (demo <mark>). */
function highlight(text: string, q: string): ReactNode {
  const tokens = q.trim().split(/\s+/).filter((t) => t.length > 0).map(escapeRe);
  if (!tokens.length) return text;
  const re = new RegExp(`(${tokens.join("|")})`, "ig");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>));
}

type Option = { key: string; href: string; external?: boolean; recent?: string };

const VOICE_DEMO = "onion hair oil";

/**
 * Header search (demo form.search + renderDrop): category select, input, photo + voice buttons and the
 * gradient submit — with a live, debounced suggestions dropdown from /api/v1/search/suggest:
 * sponsored suggestion (slot S1), "Search for …", concerns, brands, products, recent + trending searches.
 * Full keyboard support (↑/↓/Enter/Esc) via aria-activedescendant.
 */
export function SearchBox({ categories }: { categories: ChromeCategory[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SuggestResult | null>(null);
  const [active, setActive] = useState(-1);
  const [listening, setListening] = useState(false);
  const recentRaw = useSyncExternalStore(subscribeRecent, readRecent, () => null);
  const recent = useMemo(() => parseRecent(recentRaw), [recentRaw]);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cache = useRef(new Map<string, SuggestResult>());
  const latest = useRef("");
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback((query: string, category: string, immediate = false) => {
    const key = `${category}|${query.trim().toLowerCase()}`;
    latest.current = key;
    clearTimeout(debounce.current);
    const hit = cache.current.get(key);
    if (hit) {
      setData(hit);
      return;
    }
    const run = async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (category !== "all") params.set("cat", category);
        const res = await fetch(`/api/v1/search/suggest?${params}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { data: SuggestResult };
        cache.current.set(key, json.data);
        if (latest.current === key) setData(json.data);
      } catch {
        /* aborted / offline — keep the previous suggestions */
      }
    };
    if (immediate) void run();
    else debounce.current = setTimeout(run, 120);
  }, []);

  // prefill from /s?q=… (direct visits and client navigations)
  useEffect(() => {
    const sync = () => {
      if (location.pathname !== "/s") return;
      const sp = new URLSearchParams(location.search);
      setQ(sp.get("q") ?? "");
      const c = sp.get("cat");
      if (c && categories.some((x) => x.slug === c)) setCat(c);
    };
    sync();
    window.addEventListener("tbb:route", sync);
    return () => window.removeEventListener("tbb:route", sync);
  }, [categories]);

  // close on outside pointer / route change
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onRoute = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("tbb:route", onRoute);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("tbb:route", onRoute);
    };
  }, [open]);

  useEffect(() => () => {
    clearTimeout(debounce.current);
    abort.current?.abort();
  }, []);

  const remember = (term: string) => {
    const t = term.trim();
    if (!t) return;
    writeRecent([t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())]);
  };

  const searchHref = (term: string) => {
    const params = new URLSearchParams();
    if (term.trim()) params.set("q", term.trim());
    if (cat !== "all") params.set("cat", cat);
    return `/s?${params}`;
  };

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const submit = (term: string) => {
    remember(term);
    close();
    inputRef.current?.blur();
    router.push(searchHref(term));
  };

  /* ───────── build rows (in display order) ───────── */
  const qt = q.trim();
  const sp = data?.sponsored ?? null;
  const options: Option[] = [];
  if (sp) options.push({ key: "sp", href: sp.href, external: true });
  if (qt) {
    options.push({ key: "q", href: searchHref(qt), recent: qt });
    data?.concerns.forEach((c) => options.push({ key: `c:${c.slug}`, href: `/s?concern=${encodeURIComponent(c.slug)}`, recent: qt }));
    data?.brands.forEach((b) => options.push({ key: `b:${b.slug}`, href: `/brand/${b.slug}` }));
    data?.products.forEach((p) => options.push({ key: `p:${p.id}`, href: `/p/${p.slug}`, recent: qt }));
  } else {
    recent.slice(0, 4).forEach((r) => options.push({ key: `r:${r}`, href: searchHref(r), recent: r }));
    data?.trending.forEach((t) => options.push({ key: `t:${t}`, href: searchHref(t), recent: t }));
  }
  const idx = (key: string) => options.findIndex((o) => o.key === key);
  const optProps = (key: string) => {
    const i = idx(key);
    return {
      id: `sd-opt-${i}`,
      role: "option" as const,
      tabIndex: -1,
      "aria-selected": active === i,
      onMouseEnter: () => setActive(i),
      onClick: () => {
        const o = options[i];
        if (o?.recent) remember(o.recent);
        close();
      },
    };
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => (options.length ? (a + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? -1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
      e.preventDefault();
      const o = options[active];
      if (o.recent) remember(o.recent);
      close();
      if (o.external) window.location.assign(o.href);
      else router.push(o.href);
    } else if (e.key === "Delete" && open && active >= 0 && options[active]?.key.startsWith("r:")) {
      e.preventDefault();
      const term = options[active].key.slice(2);
      writeRecent(recent.filter((r) => r !== term));
      setActive(-1);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      } else inputRef.current?.blur();
    }
  };

  const onVoice = () => {
    if (listening) return;
    setQ("");
    setListening(true);
    inputRef.current?.focus();
    setTimeout(() => {
      setListening(false);
      setQ(VOICE_DEMO);
      setOpen(true);
      setActive(-1);
      load(VOICE_DEMO, cat, true);
      inputRef.current?.focus();
    }, 1400);
  };

  const catLabel = cat === "all" ? "All" : (categories.find((c) => c.slug === cat)?.short ?? "All");
  const catName = cat === "all" ? null : categories.find((c) => c.slug === cat)?.name;
  const showDrop = open && (options.length > 0 || Boolean(qt));

  return (
    <form
      ref={formRef}
      className="search"
      role="search"
      autoComplete="off"
      action="/s"
      onBlur={(e) => {
        if (open && !(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) close();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
    >
      <label className="s-cat">
        <span className="s-cat-l">{catLabel}</span>
        <Icon name="chevDown" />
        <select
          name="cat"
          aria-label="Search category"
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            if (open) load(q, e.target.value, true);
          }}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <input
        ref={inputRef}
        name="q"
        type="search"
        value={q}
        enterKeyHint="search"
        placeholder={listening ? "🎙️ Listening…" : "Search 50+ brands, products & concerns — try “hair fall”"}
        className={listening ? "listening" : undefined}
        aria-label="Search The Big Brands"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDrop}
        aria-controls="sdrop"
        aria-activedescendant={showDrop && active >= 0 ? `sd-opt-${active}` : undefined}
        onFocus={() => {
          setOpen(true);
          load(q, cat, true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
          load(e.target.value, cat);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="s-ico"
        data-action="visual-search"
        title="Search with a photo"
        aria-label="Search with a photo"
        onClick={() => toast("Search by photo — snap a product to find it (coming with the app)", { icon: "camera" })}
      >
        <Icon name="camera" />
      </button>
      <button type="button" className={cx("s-ico", listening && "is-on")} title="Search by voice" aria-label="Search by voice" onClick={onVoice}>
        <Icon name="mic" />
      </button>
      <button className="s-go" type="submit" aria-label="Search">
        <Icon name="search" />
      </button>

      <div
        className={cx("s-drop", showDrop && "open")}
        id="sdrop"
        role="listbox"
        aria-label="Search suggestions"
        // keep focus in the input while clicking a suggestion (so the blur-to-close above never eats the click)
        onMouseDown={(e) => e.preventDefault()}
      >
        {showDrop ? (
          <>
            {sp ? (
              <a className={cx("sd-sp pz-slot", active === idx("sp") && "is-active")} data-slot="S1" href={sp.href} rel="sponsored" {...optProps("sp")}>
                <PzBadge label={sp.isHouse ? "The Big Brands" : "Ad"} />
                {sp.brand ? (
                  <span className="sd-sp-logo">
                    <BrandLogo brand={sp.brand} size={13} />
                  </span>
                ) : null}
                <span className="sd-sp-t">{sp.text}</span>
                <Icon name="arrow" />
                <SlotTag slot={sp.slot} />
              </a>
            ) : null}

            {qt ? (
              <>
                <Link className={cx("sd-row sd-q", active === idx("q") && "is-active")} href={searchHref(qt)} prefetch={false} {...optProps("q")}>
                  <Icon name="search" />
                  <span>
                    Search for “<b>{qt}</b>”{catName ? <small>in {catName}</small> : null}
                  </span>
                </Link>
                {data?.concerns.map((c) => (
                  <Link key={c.slug} className={cx("sd-row", active === idx(`c:${c.slug}`) && "is-active")} href={`/s?concern=${encodeURIComponent(c.slug)}`} prefetch={false} {...optProps(`c:${c.slug}`)}>
                    <Icon name="target" />
                    <span>
                      {highlight(c.name, qt)} <small>Shop by concern</small>
                    </span>
                  </Link>
                ))}
                {data?.brands.map((b) => (
                  <Link key={b.slug} className={cx("sd-row", active === idx(`b:${b.slug}`) && "is-active")} href={`/brand/${b.slug}`} prefetch={false} {...optProps(`b:${b.slug}`)}>
                    <Icon name="store" />
                    <span>
                      {highlight(b.name, qt)} <small>Brand store</small>
                    </span>
                  </Link>
                ))}
                {data?.products.map((p) => (
                  <Link key={p.id} className={cx("sd-row sd-prod", active === idx(`p:${p.id}`) && "is-active")} href={`/p/${p.slug}`} prefetch={false} {...optProps(`p:${p.id}`)}>
                    <ProductImage product={p} className="sd-art" sizes="36px" decorative />
                    <span>{highlight(`${p.brand.isOwn ? p.brand.word || p.brandName : p.brandName} ${p.name}`, qt)}</span>
                    <b>{formatINR(p.price)}</b>
                  </Link>
                ))}
                {data && data.q.trim().toLowerCase() === qt.toLowerCase() && !data.products.length && !data.brands.length && !data.concerns.length ? (
                  <p className="sd-empty" role="presentation">
                    No exact matches — press Enter to search everything.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {recent.length ? (
                  <div role="group" aria-labelledby="sd-h-recent">
                    <div className="sd-h sd-h-row" role="presentation">
                      <span id="sd-h-recent">Recent searches</span>
                      <button
                        type="button"
                        className="sd-clear"
                        tabIndex={-1}
                        aria-hidden="true"
                        title="Clear recent searches (or press Delete on a highlighted search)"
                        onClick={() => {
                          writeRecent([]);
                          setActive(-1);
                          inputRef.current?.focus();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    {recent.slice(0, 4).map((r) => (
                      <Link key={r} className={cx("sd-row", active === idx(`r:${r}`) && "is-active")} href={searchHref(r)} prefetch={false} {...optProps(`r:${r}`)}>
                        <Icon name="clock" />
                        <span>{r}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                {data?.trending.length ? (
                  <>
                    <div className="sd-h" role="presentation" id="sd-h-trend">
                      Trending now
                    </div>
                    <div className="sd-chips" role="group" aria-labelledby="sd-h-trend">
                      {data.trending.map((t) => (
                        <Link key={t} className={cx("sd-chip", active === idx(`t:${t}`) && "is-active")} href={searchHref(t)} prefetch={false} {...optProps(`t:${t}`)}>
                          <Icon name="trending" />
                          {t}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </form>
  );
}
