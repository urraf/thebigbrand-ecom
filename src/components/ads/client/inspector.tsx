"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { AdSlotInfo } from "@/types/shared";
import { Icon } from "@/components/ui/icon";
import { toggleInspector } from "@/components/store/chrome-client";
import { ensureTracker } from "./tracker";

/**
 * "Show ad slots" inspector (demo renderInspector): a floating pill + panel listing every paid placement on the
 * current page (from the DOM's [data-slot] wrappers), with its rate, the page's potential monthly revenue and
 * the site-wide total (GET /api/v1/ads/slots). Clicking a row scrolls to the slot and flashes it.
 * The on/off state is shared with the store chrome (body.inspect + tbb_inspect cookie) and kept in localStorage.
 * Also starts the impression tracker for the page.
 */
const LS_KEY = "tbb_inspect";
let slotCache: Promise<AdSlotInfo[]> | null = null;
function loadSlots(): Promise<AdSlotInfo[]> {
  if (!slotCache) {
    slotCache = fetch("/api/v1/ads/slots", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j: { data?: AdSlotInfo[] }) => j.data ?? [])
      .catch(() => {
        slotCache = null;
        return [];
      });
  }
  return slotCache;
}

function readStored(): boolean {
  try {
    if (localStorage.getItem(LS_KEY) === "1") return true;
  } catch {
    /* storage blocked */
  }
  return document.cookie.split("; ").some((c) => c === "tbb_inspect=1");
}
function store(on: boolean) {
  try {
    localStorage.setItem(LS_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked */
  }
}

function pageCodes(): string[] {
  const els = document.querySelectorAll<HTMLElement>("#main [data-slot], #hdr [data-slot], [data-slot]");
  const out: string[] = [];
  els.forEach((e) => {
    const c = e.dataset.slot;
    if (c && !out.includes(c)) out.push(c);
  });
  return out;
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function AdInspector() {
  // shared with the store chrome: body.inspect is the source of truth, "tbb:inspect" announces changes
  const on = useSyncExternalStore(
    (cb) => {
      window.addEventListener("tbb:inspect", cb);
      return () => window.removeEventListener("tbb:inspect", cb);
    },
    () => document.body.classList.contains("inspect"),
    () => false,
  );
  const [codes, setCodes] = useState<string[]>([]);
  const [slots, setSlots] = useState<AdSlotInfo[]>([]);

  const recount = useCallback(() => setCodes(pageCodes()), []);

  useEffect(() => {
    ensureTracker();
    const stored = readStored();
    if (stored && !document.body.classList.contains("inspect")) {
      document.body.classList.add("inspect");
      document.cookie = `tbb_inspect=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      window.dispatchEvent(new CustomEvent("tbb:inspect", { detail: { on: true } }));
    }
    void loadSlots().then(setSlots);
    const first = setTimeout(recount, 0);
    const onInspect = (e: Event) => {
      const v = Boolean((e as CustomEvent<{ on: boolean }>).detail?.on);
      store(v);
      if (v) recount();
    };
    let t: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(t);
      t = setTimeout(recount, 300);
    };
    window.addEventListener("tbb:inspect", onInspect);
    window.addEventListener("tbb:route", later);
    const mo = new MutationObserver(later);
    mo.observe(document.getElementById("main") ?? document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("tbb:inspect", onInspect);
      window.removeEventListener("tbb:route", later);
      mo.disconnect();
      clearTimeout(t);
      clearTimeout(first);
    };
  }, [recount]);

  const byCode = new Map(slots.map((s) => [s.code, s]));
  const here = codes.map((c) => byCode.get(c)).filter((s): s is AdSlotInfo => !!s);
  const pageEst = here.reduce((a, s) => a + s.potentialMonthly, 0);
  const siteEst = slots.reduce((a, s) => a + s.potentialMonthly, 0);

  const jump = (code: string) => {
    const el = document.querySelector<HTMLElement>(`#main [data-slot="${code}"], #hdr [data-slot="${code}"], [data-slot="${code}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.classList.remove("slot-flash");
    void el.offsetWidth;
    el.classList.add("slot-flash");
    setTimeout(() => el.classList.remove("slot-flash"), 1600);
  };

  return (
    <div id="inspector">
      <div className="ins-panel" role="region" aria-label="Ad inventory on this page" hidden={!on}>
        <div className="ins-h">
          <b>
            <Icon name="megaphone" /> Ad inventory on this page
          </b>
          <button type="button" className="ib-sm" onClick={() => toggleInspector()} aria-label="Hide ad slots">
            <Icon name="close" />
          </button>
        </div>
        {here.length ? (
          <ul>
            {here.map((s) => (
              <li key={s.code}>
                <button type="button" className="ins-row" onClick={() => jump(s.code)} aria-label={`Jump to ${s.code} ${s.name}`}>
                  <b>{s.code}</b>
                  <span>
                    {s.name}
                    <small>
                      {s.format}
                      {!s.isActive ? " · paused" : ""}
                    </small>
                  </span>
                  <em>{s.rateLabel}</em>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ins-empty">No ad slots on this page.</p>
        )}
        <div className="ins-sum">
          <div>
            <small>This page · potential / month</small>
            <b>{inr(pageEst)}</b>
          </div>
          <div>
            <small>All {slots.length || "—"} slots · site-wide</small>
            <b>{inr(siteEst)}</b>
          </div>
        </div>
        <Link href="/advertise#av-ratecard" className="ins-link" prefetch={false}>
          See full rate card <Icon name="arrow" />
        </Link>
      </div>
      <button type="button" className={on ? "ins-btn on" : "ins-btn"} onClick={() => toggleInspector()} aria-pressed={on}>
        <Icon name={on ? "eyeOff" : "eye"} />
        <span>{on ? "Hide" : "Show"} ad slots</span>
        {codes.length ? <i>{codes.length}</i> : null}
      </button>
    </div>
  );
}
