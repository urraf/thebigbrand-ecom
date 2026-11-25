"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AdTheme, BrandLite, ProductCardData } from "@/types/shared";
import type { RecentBooking } from "@/server/ads/advertise";
import { BrandLogo } from "@/components/ui/brand-logo";
import { lum } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import { PzBadge } from "@/components/ui/pz-slot";
import { ZnVisual } from "../parts";
import { dLabel, fmt, nf } from "./shared";

export type HvSlide = { id: string; isHouse: boolean; kicker: string | null; headline: string; cta: string | null; theme: AdTheme | null; product: ProductCardData | null };
export type HvCard = { id: string; brand: BrandLite | null; headline: string; theme: AdTheme | null; product: ProductCardData | null };
export type HvStrip = { brand: BrandLite | null; headline: string; theme: AdTheme | null } | null;
export type HvSearch = { brand: BrandLite | null; headline: string; subline: string | null; rows: { product: ProductCardData; sponsored: boolean }[] } | null;
export type HvKpi = { today: number; ctr: number; live: number; daily: number[]; clicksToday: number; label: string };

export function Spark({ vals, w, h, className = "" }: { vals: number[]; w: number; h: number; className?: string }) {
  const v = vals.length > 1 ? vals : [0, ...(vals.length ? vals : [0])];
  const max = Math.max(...v);
  const min = Math.min(...v);
  const pts = v.map((x, i) => [(i / (v.length - 1)) * w, h - 4 - ((x - min) / (max - min || 1)) * (h - 10)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className={`av-spark ${className}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w} ${h} L0 ${h} Z`} className="av-spark-a" />
      <path d={line} className="av-spark-l" />
      <circle cx={last[0]} cy={last[1]} r="3.5" className="av-spark-d" />
    </svg>
  );
}

const STATUS: Record<string, [string, string]> = {
  APPROVED: ["Live", "live"],
  PENDING_REVIEW: ["In review", "pending"],
  PAUSED: ["Paused", "paused"],
};

/**
 * The hero mock-up (demo heroVisual): a browser window with the live H1 billboard rotating, the H2 cards and
 * the H3 strip, a phone showing the S2 search banner, slot tags with live rates, a live delivery report card
 * (real impressions today / CTR / live campaigns) and the latest real bookings. Scales to fit its column.
 */
export function HeroVisual({ slides, cards, strip, search, tags, kpi, bookings }: { slides: HvSlide[]; cards: HvCard[]; strip: HvStrip; search: HvSearch; tags: { H1: string; H2: string; S2: string }; kpi: HvKpi; bookings: RecentBooking[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [si, setSi] = useState(0);
  const [bi, setBi] = useState(0);
  const [out, setOut] = useState(false);

  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const fit = () => setZoom(Math.min(1.1, Math.max(0.4, w.clientWidth / 620)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(w);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setInterval>[] = [];
    if (slides.length > 1) timers.push(setInterval(() => setSi((i) => (i + 1) % slides.length), 3400));
    let swap: ReturnType<typeof setTimeout> | undefined;
    if (bookings.length > 1) {
      timers.push(
        setInterval(() => {
          setOut(true);
          swap = setTimeout(() => {
            setBi((i) => (i + 1) % bookings.length);
            setOut(false);
          }, 320);
        }, 4600),
      );
    }
    return () => {
      timers.forEach(clearInterval);
      clearTimeout(swap);
    };
  }, [slides.length, bookings.length]);

  const bk = bookings[bi % Math.max(1, bookings.length)];
  return (
    <div className="av-hv-wrap" ref={wrap} aria-hidden="true">
      <div className="av-hv" style={{ zoom } as CSSProperties}>
        <div className="av-hv-win">
          <div className="av-hv-bar">
            <i />
            <i />
            <i />
            <span>
              <Icon name="shield" />
              thebigbrands.co.in
            </span>
          </div>
          <div className="av-hv-hdr">
            <b>tbb</b>
            <span>
              <Icon name="search" />
              Search 50+ brands…
            </span>
            <u />
          </div>
          <div className="av-hv-nav">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i className="hl" />
          </div>
          <div className="av-hv-page">
            <div className="av-hv-bill">
              {slides.map((a, i) => {
                const t = a.theme ?? {};
                const fg = t.fg || "#ffffff";
                const ctaInk = lum(fg) > 0.5 ? "#140a24" : "#ffffff";
                return (
                  <div key={a.id} className={i === si ? "av-hv-slide on" : "av-hv-slide"} style={{ background: t.bg || "#22103b", color: fg }}>
                    <div className="av-hv-sc">
                      <small>{a.kicker || ""}</small>
                      <b>{a.headline}</b>
                      <span className="av-hv-cta" style={{ background: fg, color: ctaInk }}>
                        {a.cta || "Shop now"}
                      </span>
                    </div>
                    <div className="av-hv-art">{a.product ? <ZnVisual product={a.product} sizes="110px" /> : null}</div>
                    {a.isHouse ? <PzBadge label="The Big Brands" className="av-house" /> : <PzBadge />}
                  </div>
                );
              })}
              <span className="av-hv-dots">
                {slides.map((a, i) => (
                  <i key={a.id} className={i === si ? "on" : undefined} />
                ))}
              </span>
            </div>
            <div className="av-hv-cards">
              {cards.map((a) => {
                const t = a.theme ?? {};
                return (
                  <div key={a.id} className="av-hv-card" style={{ background: t.bg && !/gradient/.test(t.bg) ? t.bg : "#f4f1fa", color: t.fg || "#17121f" }}>
                    {a.brand ? <BrandLogo brand={a.brand} size={9} color={t.accent || a.brand.color} showSub={false} /> : null}
                    <em>{a.headline}</em>
                    <i>{a.product ? <ZnVisual product={a.product} sizes="40px" blend /> : null}</i>
                  </div>
                );
              })}
            </div>
            {strip ? (
              <div className="av-hv-strip" style={{ background: strip.theme?.bg || "#0a2a8a", color: strip.theme?.fg || "#fff" }}>
                {strip.brand ? <BrandLogo brand={strip.brand} size={9} color={strip.theme?.fg || "#fff"} showSub={false} /> : null}
                <span>{strip.headline}</span>
                <PzBadge />
              </div>
            ) : null}
          </div>
        </div>
        {search ? (
          <div className="av-hv-phone">
            <div className="av-hv-scr">
              <div className="av-hv-ph-h">
                <span>
                  <Icon name="search" />
                  vitamin c serum
                </span>
              </div>
              <div className="av-hv-ph-ban">
                <PzBadge />
                {search.brand ? <BrandLogo brand={search.brand} size={7.5} showSub={false} /> : null}
                <b>{search.headline}</b>
                <small>{search.subline ? `${search.subline.slice(0, 34)} ›` : "Shop now ›"}</small>
              </div>
              {search.rows.map(({ product: p, sponsored }) => (
                <div key={p.id} className="av-hv-pr">
                  <span className="av-hv-pa" style={{ "--tint": p.art.c1 ?? "#e7e4ee" } as CSSProperties}>
                    <ZnVisual product={p} sizes="40px" blend />
                  </span>
                  <span className="av-hv-pt">
                    <i />
                    <i />
                    <b>{fmt(p.price)}</b>
                  </span>
                  {sponsored ? <em>Sponsored</em> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <span className="av-hv-tag av-t1">
          <b>H1</b>Hero Billboard<em>{tags.H1}</em>
        </span>
        <span className="av-hv-tag av-t2">
          <b>H2</b>Spotlight cards<em>{tags.H2}</em>
        </span>
        <span className="av-hv-tag av-t3">
          <b>S2</b>Search banner<em>{tags.S2}</em>
        </span>
        <div className="av-hv-kpi">
          <div className="av-hv-kpi-h">
            <span className="av-live">
              <i />
              Live
            </span>
            Ad delivery report
          </div>
          <div className="av-hv-kpi-n">
            <b>{kpi.today.toLocaleString("en-IN")}</b>
            <small>ad impressions {kpi.label}</small>
          </div>
          <div className="av-hv-kpi-g">
            <span>
              <b>{(kpi.ctr * 100).toFixed(1)}%</b>
              <small>CTR (30d)</small>
            </span>
            <span>
              <b>{nf(kpi.clicksToday)}</b>
              <small>clicks {kpi.label}</small>
            </span>
            <span>
              <b>{kpi.live}</b>
              <small>live ads</small>
            </span>
          </div>
          <Spark vals={kpi.daily} w={200} h={34} />
        </div>
        {bk ? (
          <div className={out ? "av-hv-booked out" : "av-hv-booked"}>
            <span className="av-hb-ic">
              <Icon name="zap" />
            </span>
            <span className="av-hb-t">
              <b>{bk.brand}</b> booked <b>{bk.slot}</b>
              <small>
                {dLabel(bk.start).replace(/^\w+,\s*/, "")} – {dLabel(bk.end).replace(/^\w+,\s*/, "")} · <i className={`av-st-${STATUS[bk.status]?.[1] ?? "paused"}`}>{STATUS[bk.status]?.[0] ?? bk.status}</i>
              </small>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
