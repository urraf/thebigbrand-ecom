/**
 * Search / product / cart / thank-you creatives (S2, S4, S3·P1·C1 sponsored products, P2, C2) — ports of the
 * demo's search.js, product.js and checkout.js ad renderers. Server Components.
 */
import type { CSSProperties, ReactNode } from "react";
import type { ServedAd } from "@/types/shared";
import type { ZoneSlot } from "@/server/ads/slots";
import { BrandLogo } from "@/components/ui/brand-logo";
import { cx, lum, shade } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import { ProductCard } from "@/components/ui/product-card";
import { productTint } from "@/components/ui/product-image";
import { PzBadge, PzSlot } from "@/components/ui/pz-slot";
import { Rail } from "@/components/ui/rail";
import { trackedHref } from "./lib/links";
import { cssv, isHex, kickerOf, themeOf } from "./lib/theme";
import { rupees, SpLabel, trackProps, ZnPhoto, ZnVisual } from "./parts";
import { slotInfo } from "./home";
import { WhyButton } from "./client/why";

const badgeLabel = (ad: ServedAd) => (ad.isHouse ? "The Big Brands" : "Ad");

/** Light gradient theme from a brand colour (demo lightTheme) — S2 default. */
function lightTheme(color: string, accent: string | null) {
  const c = isHex(color) ? color : "#333333";
  const dark = lum(c) < 0.15;
  const tint = dark ? (accent && isHex(accent) && lum(accent) > 0.9 ? "#efece6" : shade(accent && isHex(accent) ? accent : "#e7e4ee", 0.55)) : shade(c, 0.86);
  return { bg: `linear-gradient(100deg, ${tint} 0%, ${shade(tint, 0.55)} 48%, #ffffff 100%)`, fg: dark ? "#151515" : shade(c, -0.5), accent: dark ? "#151515" : c };
}
/** Dark theme from a brand colour (demo darkTheme) — S4 default. */
function darkTheme(color: string, accent: string | null) {
  const c = isHex(color) ? color : "#333333";
  if (lum(c) < 0.15) {
    const ac = accent && isHex(accent) && lum(accent) < 0.85 ? accent : "#ffffff";
    return { bg: `radial-gradient(90% 55% at 50% 60%, ${ac}38, transparent 70%), linear-gradient(165deg, #0c0c0e, #2a2a30)`, fg: "#ffffff", accent: ac };
  }
  return { bg: `radial-gradient(90% 55% at 50% 60%, rgba(255,255,255,.24), transparent 70%), linear-gradient(165deg, ${shade(c, -0.5)}, ${c} 72%, ${shade(c, 0.16)})`, fg: "#ffffff", accent: "#ffffff" };
}

/** Shrink long wordmarks so they fit narrow logo columns ("THE DERMA CO", "BELLA VITA"). */
function logoSize(word: string, max: number): number {
  const n = word.length;
  if (n >= 12) return Math.round(max * 0.62);
  if (n >= 10) return Math.round(max * 0.72);
  if (n >= 8) return Math.round(max * 0.85);
  return max;
}

// ───────────────────────────── S2 · search headline banner ─────────────────────────────

export function SearchHeadlineZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const b = ad.brand;
  const base = b ? lightTheme(b.color, b.accent) : { bg: "#ffffff", fg: "#151515", accent: "#151515" };
  const bg = cssv(ad.theme?.bg) || base.bg;
  const fg = isHex(ad.theme?.fg) ? ad.theme!.fg! : base.fg;
  const dark = lum(fg) > 0.6;
  const ac = isHex(ad.theme?.accent) ? ad.theme!.accent! : base.accent;
  const acFg = lum(ac) > 0.62 ? "#151515" : "#ffffff";
  const logoColor = dark ? fg : b && lum(b.color) < 0.8 ? b.color : fg;
  const s0 = (bg.match(/#[0-9a-f]{6}\b/i) ?? ["#ffffff"])[0];
  const prods = ad.products.slice(0, 3);
  const label = b ? `Sponsored: ${b.name}` : "Sponsored";
  return (
    <PzSlot slot={slotInfo(slot)} className={cx("zn-s2-slot", className)}>
      <section
        className={cx("zn-s2", dark && "is-dark", !prods.length && "no-prods", ad.imageUrl && "has-img")}
        style={{ "--s2-bg": bg, "--s2-fg": fg, "--s2-ac": ac, "--s2-acfg": acFg, "--s2-s0": s0 } as CSSProperties}
        aria-label={ad.isHouse ? "The Big Brands" : label}
        {...trackProps(ad)}
      >
        {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} mobileSrc={ad.mobileImageUrl} alt="" sizes="(max-width: 760px) 100vw, 1100px" className="zn-s2-img" /> : null}
        <div className="zn-s2-id">
          {b ? (
            <a className="zn-s2-logo" href={ad.clickUrl} rel="sponsored" aria-label={`${b.name} store`}>
              <BrandLogo brand={b} size={logoSize(b.word || b.name, 30)} color={logoColor} />
            </a>
          ) : null}
          {kickerOf(ad.kicker) ? <span className="zn-s2-tl">{kickerOf(ad.kicker)}</span> : null}
        </div>
        <div className="zn-s2-copy">
          <div className="zn-s2-lbl">
            <PzBadge label={badgeLabel(ad)} />
            {!ad.isHouse && b ? <span>Sponsored by {b.name}</span> : null}
          </div>
          <h2>
            <a href={ad.clickUrl} rel="sponsored">
              {ad.headline}
            </a>
          </h2>
          {ad.subline ? <p>{ad.subline}</p> : null}
          <a className="zn-s2-cta" href={ad.clickUrl} rel="sponsored">
            {ad.ctaLabel || "Shop now"}
            <Icon name="arrow" />
          </a>
        </div>
        {prods.length ? (
          <div className="zn-s2-prods">
            {prods.map((p) => (
              <a key={p.id} className="zn-s2-p" href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored">
                <span className="zn-s2-art" style={{ "--tint": productTint(p) } as CSSProperties}>
                  <ZnVisual product={p} sizes="120px" blend />
                </span>
                <span className="zn-s2-pn">{p.name}</span>
                <span className="zn-s2-pr">
                  <b>{rupees(p.price)}</b>
                  {p.reviewCount > 0 ? (
                    <span>
                      <Icon name="star" />
                      {p.rating.toFixed(1)}
                    </span>
                  ) : null}
                </span>
              </a>
            ))}
          </div>
        ) : b ? (
          <div className="zn-s2-mark" aria-hidden="true">
            <BrandLogo brand={b} size={46} color={logoColor} />
          </div>
        ) : null}
      </section>
    </PzSlot>
  );
}

// ───────────────────────────── S4 · in-grid native tile ─────────────────────────────

export function NativeTileZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const b = ad.brand;
  const base = b ? darkTheme(b.color, b.accent) : { bg: "#22103b", fg: "#ffffff", accent: "#ffffff" };
  const bg = cssv(ad.theme?.bg) || base.bg;
  const fg = isHex(ad.theme?.fg) ? ad.theme!.fg! : base.fg;
  const dark = lum(fg) > 0.6;
  const ac = isHex(ad.theme?.accent) ? ad.theme!.accent! : base.accent;
  const acFg = lum(ac) > 0.62 ? "#151515" : "#ffffff";
  const p = ad.products[0];
  const from = ad.products.length ? Math.min(...ad.products.map((x) => x.price)) : 0;
  return (
    <PzSlot slot={slotInfo(slot)} className={cx("zn-s4-slot", className)}>
      <article className={cx("zn-s4", dark && "is-dark")} style={{ "--s4-bg": bg, "--s4-fg": fg, "--s4-ac": ac, "--s4-acfg": acFg } as CSSProperties} aria-label={ad.isHouse ? "The Big Brands" : `Sponsored: ${b?.name ?? ""}`} {...trackProps(ad)}>
        <div className="zn-s4-top">
          <PzBadge label={badgeLabel(ad)} />
          {b ? (
            <a href={ad.clickUrl} rel="sponsored" className="zn-s4-logo" aria-label={`${b.name} store`}>
              <BrandLogo brand={b} size={17} color={dark ? fg : b.color} />
            </a>
          ) : null}
        </div>
        <h3>
          <a href={ad.clickUrl} rel="sponsored">
            {ad.headline}
          </a>
        </h3>
        {ad.subline ? <p>{ad.subline}</p> : null}
        {p ? (
          <a className="zn-s4-art" href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored" aria-label={`${p.brand.name} ${p.name}`}>
            <ZnVisual product={p} sizes="200px" />
            <span className="zn-s4-price">
              from <b>{rupees(from)}</b>
            </span>
          </a>
        ) : b ? (
          <div className="zn-s4-mark" aria-hidden="true">
            <BrandLogo brand={b} size={34} color={dark ? fg : b.color} />
          </div>
        ) : null}
        <a className="zn-s4-cta" href={ad.clickUrl} rel="sponsored">
          {ad.ctaLabel || "Shop now"}
          <Icon name="arrow" />
        </a>
      </article>
    </PzSlot>
  );
}

// ───────────────────────────── S3 · P1 · C1 · sponsored products ─────────────────────────────

/** Flatten served sponsored-product campaigns into (ad, product) pairs in serving order. */
export function sponsoredItems(ads: ServedAd[]) {
  return ads.flatMap((ad) => ad.products.map((product) => ({ ad, product })));
}

/** One sponsored product card in its slot wrapper (tracked link + impression). */
export function SponsoredCard({ ad, product, slot, compact, sizes, extra }: { ad: ServedAd; product: ServedAd["products"][number]; slot: ZoneSlot; compact?: boolean; sizes?: string; extra?: ReactNode }) {
  return (
    <PzSlot slot={slotInfo(slot)} className="slot-card" {...trackProps(ad)}>
      <ProductCard product={product} sponsored compact={compact} href={trackedHref(ad, `/p/${product.slug}`)} sizes={sizes} />
      {extra}
    </PzSlot>
  );
}

const SP_COPY: Record<string, { title: string; sub?: string }> = {
  S3: { title: "Sponsored products", sub: "Picks from brand partners for your search" },
  P1: { title: "Sponsored products related to this item" },
  C1: { title: "Add before checkout", sub: "Quick add-ons from brand partners — they ship in the same box." },
};

export function SponsoredRailZone({
  ads,
  slot,
  title,
  subtitle,
  className,
  layout = "rail",
  hint,
}: {
  ads: ServedAd[];
  slot: ZoneSlot;
  title?: string;
  subtitle?: string;
  className?: string;
  layout?: "rail" | "grid";
  hint?: ReactNode;
}) {
  const items = sponsoredItems(ads);
  if (!items.length) return null;
  const copy = SP_COPY[slot.code] ?? { title: "Sponsored products" };
  const h = title ?? copy.title;
  const sub = subtitle ?? copy.sub;
  const id = `zn-sp-${slot.code.toLowerCase()}`;
  const compact = slot.code === "C1";
  return (
    <section className={cx("blk zn-sp-sec", `zn-sp-${slot.code.toLowerCase()}`, className)} aria-labelledby={id}>
      <div className="zn-sp-h">
        <div className="zn-sp-t">
          <h2 id={id}>{h}</h2>
          <WhyButton label="Why these?" className="zn-why" />
          {sub ? <p>{sub}</p> : null}
        </div>
        <div className="zn-disc">
          <SpLabel text="Sponsored" />
        </div>
      </div>
      {hint}
      {layout === "grid" ? (
        <div className="zn-sp-grid">
          {items.map(({ ad, product }) => (
            <SponsoredCard key={product.id} ad={ad} product={product} slot={slot} compact={compact} />
          ))}
        </div>
      ) : (
        <Rail className={cx("zn-rail", compact && "zn-rail-c1")} label={h}>
          {items.map(({ ad, product }) => (
            <SponsoredCard key={product.id} ad={ad} product={product} slot={slot} compact={compact} sizes="(max-width: 600px) 45vw, 226px" />
          ))}
        </Rail>
      )}
    </section>
  );
}

// ───────────────────────────── P2 · buy-box brand ad ─────────────────────────────

export function BuyBoxZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const b = ad.brand;
  const th = ad.theme ?? {};
  const col = b && isHex(b.color) ? b.color : "#333333";
  const bg = cssv(th.bg) || `linear-gradient(160deg, ${shade(col, 0.88)}, ${shade(col, 0.7)})`;
  const fg = isHex(th.fg) ? th.fg : lum(col) > 0.6 ? "#151515" : shade(col, -0.45);
  const ac = isHex(th.accent) ? th.accent : col;
  const acFg = lum(ac) > 0.6 ? "#151515" : "#ffffff";
  const s0 = (bg.match(/#[0-9a-f]{6}\b/i) ?? [shade(col, 0.88)])[0];
  const p = ad.products[0];
  return (
    <div className={cx("zn-p2-wrap", className)}>
      <PzSlot slot={slotInfo(slot)} className="zn-p2-slot">
        <a
          className={cx("zn-p2", !p && "zn-p2-noart", ad.imageUrl && "has-img")}
          href={ad.clickUrl}
          rel="sponsored"
          style={{ "--p2-bg": bg, "--p2-fg": fg, "--p2-ac": ac, "--p2-acfg": acFg, "--p2-s0": s0 } as CSSProperties}
          {...trackProps(ad)}
        >
          {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} alt="" sizes="320px" className="zn-p2-img" /> : null}
          <span className="zn-p2-top">
            {b ? <BrandLogo brand={b} size={19} color={fg} /> : <span />}
            <PzBadge label={badgeLabel(ad)} />
          </span>
          {kickerOf(ad.kicker) ? <span className="zn-p2-k">{kickerOf(ad.kicker)}</span> : null}
          <b className="zn-p2-h">{ad.headline}</b>
          {ad.subline ? <span className="zn-p2-s">{ad.subline}</span> : null}
          <span className="zn-p2-cta">
            {ad.ctaLabel || "Shop now"}
            <Icon name="arrow" />
          </span>
          {p && !ad.imageUrl ? (
            <span className="zn-p2-art" style={{ "--tint": productTint(p) } as CSSProperties}>
              <ZnVisual product={p} sizes="140px" blend />
            </span>
          ) : !ad.imageUrl && b ? (
            <span className="zn-p2-mono" aria-hidden="true">
              {(b.word || b.name).slice(0, 1)}
            </span>
          ) : null}
        </a>
      </PzSlot>
      <div className="zn-p2-foot">
        <span>{ad.isHouse ? "Promoted by The Big Brands" : `Sponsored · ${b?.name ?? "Brand partner"}`}</span>
        <WhyButton label="Why this ad?" house={ad.isHouse} className="zn-why" />
      </div>
    </div>
  );
}

// ───────────────────────────── C2 · thank-you page banner ─────────────────────────────

export function ThankYouZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const th = themeOf(ad.theme ?? { bg: "linear-gradient(120deg,#22103b,#33195a)", fg: "#ffffff", accent: "#ffc94d" }, ad.brand);
  const prods = ad.products.slice(0, 3);
  const b = ad.brand;
  return (
    <div className={cx("zn-c2-wrap", className)}>
      <PzSlot slot={slotInfo(slot)} className="zn-c2-slot">
        <a className={cx("zn-c2", ad.imageUrl && "has-img")} href={ad.clickUrl} rel="sponsored" style={{ "--c2-bg": th.bg, "--c2-fg": th.fg, "--c2-ac": th.ac, "--c2-s0": th.s0 } as CSSProperties} {...trackProps(ad)}>
          {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} mobileSrc={ad.mobileImageUrl} alt="" sizes="(max-width: 760px) 100vw, 760px" className="zn-c2-img" /> : null}
          <span className="zn-c2-top">
            <PzBadge label={badgeLabel(ad)} />
            {b ? (
              <span className="zn-c2-logo">
                <BrandLogo brand={b} size={20} color={th.fg} />
              </span>
            ) : null}
          </span>
          {kickerOf(ad.kicker) ? <span className="zn-c2-k">{kickerOf(ad.kicker)}</span> : <span className="zn-c2-k">Picked for your next order</span>}
          <b className="zn-c2-h">{ad.headline}</b>
          {ad.subline ? <span className="zn-c2-s">{ad.subline}</span> : null}
          <span className={cx("zn-c2-arts", !prods.length && "is-logo")} aria-hidden="true">
            {prods.length ? prods.map((p) => <span key={p.id} className="zn-c2-art"><ZnVisual product={p} sizes="80px" /></span>) : b ? <BrandLogo brand={b} size={44} color={th.fg} /> : null}
          </span>
          <span className="zn-c2-cta">
            {ad.ctaLabel || "Shop now"} <Icon name="arrow" />
          </span>
        </a>
      </PzSlot>
      <WhyButton label={`${ad.isHouse ? "From The Big Brands" : "Sponsored"} · Why am I seeing this?`} house={ad.isHouse} className="zn-why" />
    </div>
  );
}

// ───────────────────────────── H4 on a concern page · "Presented by" chip ─────────────────────────────

export function PresentedByZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const b = ad.brand;
  if (!b) return null;
  return (
    <PzSlot slot={slotInfo(slot)} className={cx("zn-presented-slot", className)}>
      <a className="zn-presented" href={trackedHref(ad, `/brand/${b.slug}`)} rel="sponsored" aria-label={`Presented by ${b.name} — advertisement`} {...trackProps(ad)}>
        <PzBadge label={badgeLabel(ad)} />
        <span className="zn-presented-t">Presented by</span>
        <span className="zn-presented-l">
          <BrandLogo brand={b} size={16} showSub={false} />
        </span>
        <Icon name="chevRight" />
      </a>
    </PzSlot>
  );
}
