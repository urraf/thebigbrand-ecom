/**
 * CreativePreview — renders an ad creative in the shape of its slot (billboard, spotlight card, leaderboard
 * strip, concern tile, video, reel, brand tile, double billboard, coupon, deal, shelf, search suggestion,
 * sponsored product cards, buy-box rectangle, brand-store hero, in-box flyer), from unsaved editor values.
 * Pure component (no hooks) so the client editor can re-render it on every keystroke.
 * Labels follow the storefront rule: "Ad" / "Sponsored", house campaigns say "The Big Brands".
 */
import type { CSSProperties, ReactNode } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import { ProductVisual } from "@/components/ui/product-image";
import { PzBadge } from "@/components/ui/pz-slot";
import { cx, lum, safeColor, shade } from "@/components/ui/cx";
import type { BrandLite, ProductCardData } from "@/types/shared";

export type PreviewCreative = {
  slotCode: string;
  slotSize?: string | null;
  isHouse: boolean;
  brand: BrandLite | null;
  kicker: string;
  headline: string;
  subline: string;
  ctaLabel: string;
  imageUrl: string;
  mobileImageUrl: string;
  videoUrl: string;
  theme: { bg?: string; fg?: string; accent?: string };
  layout: string;
  products: ProductCardData[];
  targetKey: string;
  keywords: string[];
  meta: Record<string, unknown>;
};

const HEX = /^#[0-9a-f]{6}$/i;
const SAFE_CSS = /^[#a-zA-Z0-9(),.%\s-]+$/;
const css = (v: string | undefined) => (v && SAFE_CSS.test(v) && !/url\s*\(|expression/i.test(v) ? v : undefined);
const SAFE_IMG = /^(\/(?!\/)[^\s"'<>]*|https:\/\/[^\s"'<>]+)$/i;
const img = (v: string) => (v && SAFE_IMG.test(v) ? v : "");

function palette(c: PreviewCreative) {
  const base = c.isHouse ? "#ff3d6e" : safeColor(c.brand?.color, "#33195a");
  const col = HEX.test(base) ? base : "#33195a";
  const bg = css(c.theme.bg) ?? (c.isHouse ? "linear-gradient(120deg,#ff3d6e 0%,#ff6a4d 55%,#ffb347 100%)" : `linear-gradient(120deg, ${shade(col, -0.35)}, ${col} 60%, ${shade(col, 0.25)})`);
  const plain = HEX.test(c.theme.bg ?? "") ? (c.theme.bg as string) : col;
  const fg = css(c.theme.fg) ?? (lum(plain) < 0.6 ? "#ffffff" : "#151515");
  const accent = css(c.theme.accent) ?? (fg === "#ffffff" ? "#ffffff" : "#151515");
  const ctaFg = HEX.test(accent) && lum(accent) > 0.6 ? "#151515" : "#ffffff";
  // solid stop the photo fades into (same idea as the store's --zn-s0): first colour of the background
  const solid = /#[0-9a-f]{6}\b/i.exec(bg)?.[0] ?? col;
  return { bg, fg, accent, ctaFg, solid };
}

function Label({ c, light }: { c: PreviewCreative; light?: boolean }) {
  if (c.isHouse) {
    return (
      <span className="pz-badge" style={{ background: light ? "rgba(20,10,36,.72)" : "rgba(0,0,0,.35)" }}>
        The Big Brands
      </span>
    );
  }
  return <PzBadge label="Ad" />;
}

function Mark({ c, color, size = 15 }: { c: PreviewCreative; color?: string; size?: number }) {
  if (c.isHouse) return <b style={{ fontFamily: "var(--f-head)", fontWeight: 800, fontSize: size, color, letterSpacing: "-.03em" }}>thebigbrands</b>;
  if (!c.brand) return null;
  return <BrandLogo brand={c.brand} size={size} color={color} showSub={false} />;
}

function Visual({ c, max = 2, frame = true }: { c: PreviewCreative; max?: number; frame?: boolean }) {
  const list = c.products.slice(0, max);
  if (!list.length) {
    const name = c.brand?.name ?? "Brand";
    if (c.isHouse && !c.brand) {
      return (
        <div className="am-cre-mono" aria-hidden="true" style={{ fontSize: 22, letterSpacing: "-.04em" }}>
          tbb
        </div>
      );
    }
    return (
      <div className="am-cre-mono" aria-hidden="true">
        {name
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </div>
    );
  }
  return (
    <div className="am-cre-art" aria-hidden="true">
      {list.map((p) => (
        <span key={p.id} style={{ position: "relative", display: "block", borderRadius: frame && p.image ? 12 : 0, background: frame && p.image ? "#fff" : undefined, overflow: "hidden" }}>
          <ProductVisual product={p} sizes="120px" decorative />
        </span>
      ))}
    </div>
  );
}

function Cta({ c, p }: { c: PreviewCreative; p: ReturnType<typeof palette> }) {
  return (
    <span className="am-cre-cta" style={{ background: p.accent, color: p.ctaFg }}>
      {c.ctaLabel || "Shop now"}
      <Icon name="arrow" />
    </span>
  );
}

function Banner({ c, variant, mobile }: { c: PreviewCreative; variant?: "strip" | "center" | "card" | "video" | "box"; mobile?: boolean }) {
  const p = palette(c);
  const photo = img(mobile && c.mobileImageUrl ? c.mobileImageUrl : c.imageUrl);
  const strip = variant === "strip" && !mobile;
  const style = { background: p.bg, color: p.fg, "--cre-s0": p.solid } as CSSProperties;
  return (
    <div className={cx("am-cre", strip && "is-strip", variant === "center" && "is-center", variant === "card" && "is-card", variant === "video" && "is-video", photo && "has-img")} style={style}>
      {photo ? (
        <span className="am-cre-img" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- live preview of an arbitrary upload / URL */}
          <img src={photo} alt="" />
        </span>
      ) : null}
      {variant === "video" ? (
        <span className="am-cre-play" aria-hidden="true">
          <Icon name="play" />
        </span>
      ) : null}
      <div className="am-cre-tx">
        <div className="am-cre-top">
          <Mark c={c} color={photo ? "#fff" : p.fg} />
          <Label c={c} />
        </div>
        {c.kicker && !strip ? <span className="am-cre-k">{c.kicker}</span> : null}
        <b className="am-cre-h">{c.headline || "Your headline goes here"}</b>
        {c.subline ? <span className="am-cre-s">{c.subline}</span> : null}
        <Cta c={c} p={p} />
      </div>
      {variant === "video" || variant === "center" || photo ? null : <Visual c={c} max={strip ? 1 : 2} />}
    </div>
  );
}

function ProductCards({ c, n = 4, title }: { c: PreviewCreative; n?: number; title: string }) {
  const list = c.products.slice(0, n);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="ag-row" style={{ justifyContent: "space-between" }}>
        <b style={{ fontFamily: "var(--f-head)", fontSize: 16 }}>{title}</b>
        <span className="sp-label" style={{ fontSize: 11.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {c.isHouse ? "The Big Brands" : "Sponsored"}
          <Icon name="info" size={13} />
        </span>
      </div>
      {list.length ? (
        <div className="ag-prods">
          {list.map((p) => (
            <article key={p.id} className="blk" style={{ padding: 10, display: "grid", gap: 6, boxShadow: "none", border: "1px solid var(--line)" }}>
              <span style={{ position: "relative", display: "block", height: 110, borderRadius: 10, background: "var(--soft)", overflow: "hidden" }}>
                <ProductVisual product={p} sizes="150px" decorative />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{c.isHouse ? "The Big Brands" : "Sponsored"}</span>
              <BrandLogo brand={p.brand} size={11} showSub={false} />
              <span style={{ fontSize: 12.5, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</span>
              <Price price={p.price} mrp={p.mrp} />
            </article>
          ))}
        </div>
      ) : (
        <div className="ag-chart-empty" style={{ minHeight: 120 }}>
          Pick the products to promote (below)
        </div>
      )}
    </div>
  );
}

function Frame({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <>
      {children}
      {note ? <small className="am-muted" style={{ fontSize: 12 }}>{note}</small> : null}
    </>
  );
}

export function CreativePreview({ c, device = "desktop" }: { c: PreviewCreative; device?: "desktop" | "mobile" }) {
  const mobile = device === "mobile";
  const p = palette(c);
  const code = c.slotCode;

  switch (code) {
    case "H1":
    case "B1":
      return <Banner c={c} variant={c.layout === "center" ? "center" : undefined} mobile={mobile} />;
    case "H8":
    case "P2":
      return (
        <div style={{ maxWidth: code === "P2" ? 320 : 520 }}>
          <Banner c={c} mobile />
        </div>
      );
    case "H2":
      return <Banner c={c} variant="card" mobile={mobile} />;
    case "H3":
    case "S2":
    case "C2":
      return <Banner c={c} variant="strip" mobile={mobile} />;
    case "H5":
      return (
        <Frame note={c.videoUrl ? "Video autoplays muted on the storefront" : "Add a video URL — the poster image / colours show until it loads"}>
          <Banner c={c} variant="video" mobile={mobile} />
        </Frame>
      );
    case "H6": {
      const creator = String(c.meta.creator ?? "Creator");
      const handle = String(c.meta.handle ?? "@creator");
      const views = c.meta.views ? String(c.meta.views) : null;
      const photo = img(c.mobileImageUrl || c.imageUrl);
      return (
        <div className="am-cre is-reel" style={{ background: css(c.theme.bg) ?? "linear-gradient(180deg,#2b2b2b,#141414)", color: "#fff" }}>
          {photo ? (
            <span className="am-cre-img" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- live preview */}
              <img src={photo} alt="" />
            </span>
          ) : null}
          <span className="am-cre-play" aria-hidden="true">
            <Icon name="play" />
          </span>
          <div className="am-cre-top">
            <Label c={c} />
            {views ? <span style={{ fontSize: 11.5, fontWeight: 600 }}>{views} views</span> : null}
          </div>
          <span className="am-cre-creator">
            <i>{creator.slice(0, 1)}</i>
            {creator} <span style={{ opacity: 0.7 }}>{handle}</span>
          </span>
          <b className="am-cre-h">{c.headline || "Reel caption"}</b>
          {c.products[0] ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, borderRadius: 10, background: "rgba(255,255,255,.92)", color: "#151515", fontSize: 12 }}>
              <span style={{ position: "relative", width: 34, height: 34, flex: "none", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                <ProductVisual product={c.products[0]} sizes="34px" decorative />
              </span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.products[0].name}</span>
            </span>
          ) : null}
        </div>
      );
    }
    case "H4":
      return (
        <div className="ag-tile">
          <div className="ag-tile-h">
            <span aria-hidden="true">✨</span>
            {c.targetKey ? c.targetKey.replace(/-/g, " ").replace(/^\w/, (m) => m.toUpperCase()) : "Concern"}
          </div>
          <small>
            Presented by <Mark c={c} size={12} /> <Label c={c} light />
          </small>
          {c.headline ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.headline}</span> : null}
        </div>
      );
    case "H7":
      return (
        <div className="ag-tile" style={{ placeItems: "center", textAlign: "center", minHeight: 120 }}>
          <Mark c={c} size={22} />
          <small>
            {c.ctaLabel || "Visit store"} · <Label c={c} light />
          </small>
        </div>
      );
    case "H9": {
      return (
        <div className="ag-coupon">
          <span className="ag-coupon-v">{c.kicker || "₹50 OFF"}</span>
          <span style={{ display: "grid", gap: 4 }}>
            <Mark c={c} size={13} />
            <b style={{ fontSize: 13.5 }}>{c.headline || "Coupon title"}</b>
            <small className="am-muted">{c.subline || "Clip to save"} · {c.isHouse ? "The Big Brands" : "Ad"}</small>
            <span className="btn btn-sm btn-dark" style={{ justifySelf: "start" }}>
              <Icon name="scissors" />
              {c.ctaLabel || "Clip coupon"}
            </span>
          </span>
        </div>
      );
    }
    case "H10": {
      const prod = c.products[0];
      const deal = Number(c.meta.dealPrice) || prod?.price || 0;
      return (
        <div className="am-cre" style={{ background: p.bg, color: p.fg }}>
          <div className="am-cre-tx">
            <div className="am-cre-top">
              <Label c={c} />
              <span className="am-cre-k">{c.kicker || "Deal of the day"}</span>
            </div>
            <b className="am-cre-h">{c.headline || prod?.name || "Deal headline"}</b>
            {c.subline ? <span className="am-cre-s">{c.subline}</span> : null}
            {deal ? (
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b style={{ fontSize: 26, fontWeight: 800 }}>₹{deal.toLocaleString("en-IN")}</b>
                {prod && prod.mrp > deal ? <s style={{ opacity: 0.7 }}>₹{prod.mrp.toLocaleString("en-IN")}</s> : null}
              </span>
            ) : null}
            <span style={{ display: "inline-flex", gap: 6, fontSize: 12, fontWeight: 700 }}>
              <Icon name="clock" size={14} /> Ends in 07:42:19
            </span>
            <Cta c={c} p={p} />
          </div>
          <Visual c={c} max={1} />
        </div>
      );
    }
    case "H11":
      return (
        <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 14, background: css(c.theme.bg) ?? "var(--soft)", color: css(c.theme.fg) }}>
          <div className="ag-row">
            <Mark c={c} size={16} />
            <b style={{ fontFamily: "var(--f-head)", fontSize: 17 }}>{c.headline || "Shelf headline"}</b>
            <span className="ag-sp" />
            <Label c={c} light />
          </div>
          {c.subline ? <span style={{ fontSize: 13, opacity: 0.85 }}>{c.subline}</span> : null}
          <ProductCards c={c} n={4} title="" />
        </div>
      );
    case "S1":
      return (
        <div className="ag-sugg">
          <span className="ag-sugg-q">
            <Icon name="search" />
            {c.keywords[0] || "serum"}
          </span>
          <span className="ag-sugg-row on">
            <Icon name="search" />
            <span>
              <b>{c.headline || "Sponsored suggestion"}</b>
            </span>
            <Label c={c} light />
          </span>
          <span className="ag-sugg-row">
            <Icon name="search" />
            {(c.keywords[0] || "serum") + " for oily skin"}
          </span>
          <span className="ag-sugg-row">
            <Icon name="search" />
            {(c.keywords[0] || "serum") + " vitamin c"}
          </span>
        </div>
      );
    case "S3":
    case "S4":
    case "P1":
    case "C1":
      return (
        <ProductCards
          c={c}
          n={mobile ? 2 : code === "S4" ? 1 : 4}
          title={code === "C1" ? "Add before checkout" : code === "P1" ? "Related products" : code === "S4" ? "In your results" : "Results"}
        />
      );
    case "X1":
      return (
        <div className="ag-flyer" style={{ background: p.bg, color: p.fg }}>
          <Mark c={c} color={p.fg} size={18} />
          <span className="am-cre-k">{c.kicker || "In your box"}</span>
          <b className="am-cre-h" style={{ fontSize: 20 }}>
            {c.headline || "Flyer headline"}
          </b>
          {c.subline ? <span className="am-cre-s">{c.subline}</span> : null}
          <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 700 }}>{c.ctaLabel || "Scan to shop"}</span>
        </div>
      );
    default:
      return <Banner c={c} mobile={mobile} />;
  }
}
