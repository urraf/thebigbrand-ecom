"use client";
import type { CSSProperties, ReactNode } from "react";
import type { BrandLite, ProductCardData } from "@/types/shared";
import { BrandLogo } from "@/components/ui/brand-logo";
import { lum, shade } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import { PzBadge } from "@/components/ui/pz-slot";
import { isHex, themeFromColor } from "../lib/theme";
import { ZnVisual } from "../parts";
import { addDays, dLabel, fmt } from "./shared";

export type PreviewInput = {
  brand: BrandLite;
  products: ProductCardData[];
  headline: string;
  sub: string;
  cta: string;
  color: string;
  imageUrl?: string | null;
};

/**
 * Live creative preview for the booking form (port of the demo's creative()): renders the ad as it will look in
 * the chosen slot, desktop or phone. Scales with its container (container query units).
 */
export function CreativePreview({ slot, f, mobile, firstName = "Priya", today }: { slot: string; f: PreviewInput; mobile: boolean; firstName?: string; today: string }) {
  const col = isHex(f.color) ? f.color : isHex(f.brand.color) ? f.brand.color : "#333333";
  const t = themeFromColor(col);
  const fg = t.fg ?? "#ffffff";
  const hl = f.headline.trim() || "Your headline goes here";
  const sub = f.sub.trim();
  const cta = f.cta.trim() || "Shop now";
  const prods = f.products;
  const darkBg = lum(col) <= 0.6;
  const ctaSt: CSSProperties = { background: fg, color: darkBg ? shade(col, -0.35) : "#ffffff" };
  const light = shade(col, 0.9);
  const ink = lum(col) > 0.75 ? "#1b1b1b" : shade(col, -0.55);
  const linkCol = shade(col, lum(col) > 0.6 ? -0.5 : 0);
  const img = f.imageUrl;
  const bgStyle = (bg: string, color: string): CSSProperties =>
    img ? { backgroundImage: `linear-gradient(90deg, ${shade(col, -0.35)} 0%, ${shade(col, -0.35)}cc 40%, transparent 85%), url("${img}")`, backgroundSize: "cover", backgroundPosition: "center right", color } : { background: bg, color };

  const logo = (size: number, color: string = fg) => (
    <span className="av-cr-logo">
      <BrandLogo brand={f.brand} size={size} color={color} showSub={false} />
    </span>
  );
  const arts = (n: number, cls = "") => (
    <div className={`av-cr-arts ${cls}`}>
      {prods.slice(0, n).map((p) => (
        <span key={p.id} className="av-cr-art">
          <ZnVisual product={p} sizes="120px" />
        </span>
      ))}
    </div>
  );
  const badge = <PzBadge />;
  const copy = (extra: ReactNode = null) => (
    <div className="av-cr-copy">
      {logo(mobile ? 11 : 13)}
      <b className="av-cr-h">{hl}</b>
      {sub ? <span className="av-cr-s">{sub}</span> : null}
      {extra}
      <span className="av-cr-cta" style={ctaSt}>
        {cta} ›
      </span>
    </div>
  );

  switch (slot) {
    case "H2":
      return (
        <div className="av-cr-row av-cr-row-3">
          <div className="av-cr av-cr-card" style={{ background: light, color: ink }}>
            {badge}
            {logo(12, ink)}
            <b className="av-cr-h">{hl}</b>
            {sub ? <span className="av-cr-s">{sub}</span> : null}
            {arts(2)}
            <span className="av-cr-link" style={{ color: linkCol }}>
              {cta} ›
            </span>
          </div>
          <div className="av-ghost av-ghost-card" />
          <div className="av-ghost av-ghost-card" />
        </div>
      );
    case "H3":
      return (
        <div className="av-cr av-cr-strip" style={bgStyle(t.bg ?? col, fg)}>
          {badge}
          {logo(mobile ? 11 : 14)}
          <div className="av-cr-sc">
            <b className="av-cr-h">{hl}</b>
            {sub ? <span className="av-cr-s">{sub}</span> : null}
          </div>
          {mobile || img ? null : arts(3)}
          <span className="av-cr-cta" style={ctaSt}>
            {cta} ›
          </span>
        </div>
      );
    case "H5":
      return (
        <div className="av-cr av-cr-video" style={img ? bgStyle("", "#fff") : { background: `radial-gradient(120% 90% at 80% 30%, ${shade(col, -0.05)} 0%, ${shade(col, -0.55)} 55%, #0b0612 100%)`, color: "#fff" }}>
          {badge}
          <span className="av-cr-time">
            <Icon name="play" />
            Watch · 0:30
          </span>
          {img ? null : arts(2)}
          <span className="av-cr-play">
            <Icon name="play" />
          </span>
          <div className="av-cr-vb">
            {logo(mobile ? 10 : 12, "#fff")}
            <b className="av-cr-h">{hl}</b>
            <span className="av-cr-cta" style={{ background: "#fff", color: shade(col, -0.4) }}>
              {cta} ›
            </span>
          </div>
          <span className="av-cr-prog">
            <i />
          </span>
          <span className="av-cr-mute">
            <Icon name="volumeOff" />
          </span>
        </div>
      );
    case "H8":
      return (
        <div className="av-cr-row av-cr-row-2">
          <div className="av-cr av-cr-half" style={bgStyle(t.bg ?? col, fg)}>
            {badge}
            {copy()}
            {img ? <span /> : arts(1)}
          </div>
          {mobile ? null : <div className="av-ghost av-ghost-half" />}
        </div>
      );
    case "H10": {
      const p = prods[0];
      const deal = p ? Math.round(p.price * 0.85) : 0;
      return (
        <div className="av-cr av-cr-deal" style={{ background: light, color: ink }}>
          {badge}
          {p ? (
            <div className="av-cr-dart" style={{ background: shade(col, 0.78) }}>
              <ZnVisual product={p} sizes="100px" blend />
            </div>
          ) : null}
          <div className="av-cr-copy">
            <span className="av-cr-k">Sponsored · Deal of the Day</span>
            <b className="av-cr-h">{hl}</b>
            {sub ? <span className="av-cr-s">{sub}</span> : null}
            {p ? (
              <span className="av-cr-price">
                <b>{fmt(deal)}</b>
                <s>{fmt(p.mrp)}</s>
                <em>{Math.round((1 - deal / p.mrp) * 100)}% off</em>
              </span>
            ) : null}
          </div>
          <div className="av-cr-timer">
            <small>Ends in</small>
            <b>08:42:10</b>
            <span className="av-cr-cta" style={{ background: linkCol, color: "#fff" }}>
              {cta} ›
            </span>
          </div>
        </div>
      );
    }
    case "S2":
      return (
        <>
          <div className="av-cr-ctx">
            <Icon name="search" />
            <span>
              Results for “<b>{f.brand.name.toLowerCase()}</b>”
            </span>
          </div>
          <div className="av-cr av-cr-search" style={img ? bgStyle(light, ink) : { background: light, color: ink }}>
            {badge}
            <div className="av-cr-copy">
              {logo(mobile ? 11 : 13, img ? fg : ink)}
              <b className="av-cr-h">{hl}</b>
              {sub ? <span className="av-cr-s">{sub}</span> : null}
              <span className="av-cr-link" style={{ color: img ? fg : linkCol }}>
                {cta} ›
              </span>
            </div>
            <div className="av-cr-sp">
              {prods.slice(0, mobile ? 2 : 3).map((p) => (
                <span key={p.id} className="av-cr-spc">
                  <i style={{ background: shade(isHex(p.art.c1) ? p.art.c1! : "#e7e4ee", 0.85) }}>
                    <ZnVisual product={p} sizes="60px" blend />
                  </i>
                  <b>{fmt(p.price)}</b>
                </span>
              ))}
            </div>
          </div>
          <div className="av-ghost-grid">
            <i />
            <i />
            <i />
            <i />
          </div>
        </>
      );
    case "C2":
      return (
        <>
          <div className="av-cr-ctx ok">
            <Icon name="check" />
            <span>
              Order placed — thank you, {firstName}! Arriving {dLabel(addDays(today, 3))}
            </span>
          </div>
          <div className="av-cr av-cr-thanks" style={bgStyle(t.bg ?? col, fg)}>
            {badge}
            {copy(<span className="av-cr-k">Picked for your next order</span>)}
            {img ? <span /> : arts(2)}
          </div>
        </>
      );
    default:
      return (
        <div className="av-cr av-cr-bill" style={bgStyle(t.bg ?? col, fg)}>
          {badge}
          {copy()}
          {img ? <span /> : arts(2)}
          <span className="av-cr-dots">
            <i className="on" />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      );
  }
}
