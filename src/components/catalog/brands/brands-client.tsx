"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/toast";
import { compactNumber } from "@/lib/money";
import { words } from "@/server/catalog/text";

/**
 * Brand directory filter (find-a-brand box + category chips) — filters the server-rendered tiles in place
 * via their data attributes, so the directory stays a static page. And the brand-store Follow button
 * (remembered in this browser).
 */
export function BrandFilter({ groups, tiles }: { groups: { key: string; label: string }[]; tiles: { name: string; groups: string[] }[] }) {
  const [q, setQ] = useState("");
  const [g, setG] = useState("all");
  const qs = words(q).join(" ");
  const match = (t: { name: string; groups: string[] }) => (!qs || t.name.includes(qs)) && (g === "all" || t.groups.includes(g));
  const n = tiles.filter(match).length;
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("#sr-bgrid .sr-bt").forEach((el) => {
      el.hidden = !((!qs || (el.dataset.name ?? "").includes(qs)) && (g === "all" || (el.dataset.groups ?? "").split(" ").includes(g)));
    });
    const c = document.getElementById("sr-bcount");
    if (c) c.textContent = String(n);
    const none = document.getElementById("sr-bnone");
    if (none) none.hidden = n > 0;
    // while filtering, the featured-stores row steps aside so matches sit right under the search box
    document.body.classList.toggle("sr-dir-filtering", Boolean(qs) || g !== "all");
  }, [qs, g, n]);
  useEffect(() => () => document.body.classList.remove("sr-dir-filtering"), []);
  return (
    <div className="sr-dirtools">
      <label className="sr-find">
        <Icon name="search" />
        <span className="sr-only">Find a brand</span>
        <input type="search" placeholder="Find a brand…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      <div className="sr-bgroups" role="group" aria-label="Filter brands by category">
        {groups.map((x) => (
          <button key={x.key} type="button" className={cx("chip", g === x.key && "on")} aria-pressed={g === x.key} onClick={() => setG(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {n} brands shown
      </p>
      {n === 0 ? (
        <button type="button" className="sr-dir-reset link" onClick={() => (setQ(""), setG("all"))}>
          Reset filters
        </button>
      ) : null}
    </div>
  );
}

const KEY = "tbb_follows";
const EVT = "tbb:follows";
function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
let cache: string[] | null = null;
const snapshot = () => (cache ??= read());
const subscribe = (cb: () => void) => {
  const f = () => {
    cache = read();
    cb();
  };
  window.addEventListener(EVT, f);
  window.addEventListener("storage", f);
  return () => {
    window.removeEventListener(EVT, f);
    window.removeEventListener("storage", f);
  };
};
const EMPTY: string[] = [];

/** Follow button + store stats (followers count includes you once you follow). */
export function BrandFollow({ slug, name, followers, avg, products, basic }: { slug: string; name: string; followers: number; avg: number; products: number; basic?: boolean }) {
  const list = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const on = list.includes(slug);
  const toggle = () => {
    const next = on ? list.filter((x) => x !== slug) : [...list, slug].slice(-200);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    cache = next;
    window.dispatchEvent(new Event(EVT));
    toast(on ? `You unfollowed ${name}` : `Following ${name} — we'll show you their new launches and offers`, { icon: on ? "info" : "check" });
  };
  const btn = (
    <button type="button" className={cx("sr-follow", basic && "sr-follow-d", on && "on")} aria-pressed={on} onClick={toggle}>
      <Icon name={on ? "check" : "plus"} />
      <span>{on ? "Following" : "Follow"}</span>
    </button>
  );
  if (basic) return btn;
  return (
    <div className="sr-bh-act">
      {btn}
      <dl className="sr-bh-stats">
        {avg ? (
          <div>
            <dt>Avg rating</dt>
            <dd>
              <Icon name="star" />
              {avg.toFixed(1)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Products</dt>
          <dd>{products}</dd>
        </div>
        <div>
          <dt>Followers</dt>
          <dd>{compactNumber(followers + (on ? 1 : 0))}</dd>
        </div>
      </dl>
    </div>
  );
}
