/**
 * Homepage creatives (H1–H11) — faithful ports of the approved demo (docs/theme-reference/js/pages/home.js)
 * driven by served campaigns. Server Components; the only client islands are the hero carousel, video
 * player, countdown, add-to-cart and coupon clip buttons.
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import type { ProductCardData, ServedAd } from "@/types/shared";
import type { ZoneSlot } from "@/server/ads/slots";
import type { ConcernTile, StoreTile } from "@/server/ads/zones";
import type { WallCoupon } from "@/server/ads/coupons";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { cx, lum } from "@/components/ui/cx";
import { DeliveryDate } from "@/components/ui/delivery-date";
import { Icon } from "@/components/ui/icon";
import { ProductCard } from "@/components/ui/product-card";
import { productTint } from "@/components/ui/product-image";
import { PzSlot, type SlotInfo } from "@/components/ui/pz-slot";
import { Stars } from "@/components/ui/stars";
import { trackedHref } from "./lib/links";
import { contrast, headStyle, isHex, kickerOf, shortName, splitHeadline, themeOf, themeVars, wordmarkStyle } from "./lib/theme";
import { discountOf, HouseTag, rupees, SpLabel, SwashHeadline, trackProps, ZnHead, ZnPhoto, ZnTag, ZnVisual } from "./parts";
import { ClipButton, ClipCount } from "./client/coupon-clip";
import { Countdown } from "./client/countdown";
import { HeroCarousel, type HeroSlide } from "./client/hero-carousel";
import { VideoPlayer, type VideoScene } from "./client/video-player";

export const slotInfo = (s: ZoneSlot): SlotInfo => ({ code: s.code, name: s.name, size: s.size, rateLabel: s.rateLabel });

/** Decorative brand motifs for banners (demo motif()). */
const LEAF = "M120 14C64 58 62 160 120 226C178 160 176 58 120 14Z";
function Motif({ slug }: { slug: string | null | undefined }) {
  const k = ({ himalaya: "leaf", biotique: "leaf", plum: "leaf", garnier: "leaf", mamaearth: "leaf", bellavita: "frame", loreal: "frame", lakme: "frame", beardo: "stripe" } as Record<string, string>)[slug ?? ""] ?? "ring";
  if (k === "leaf") {
    return (
      <svg className="zn-motif zn-motif-leaf" viewBox="0 0 240 240" fill="currentColor" aria-hidden="true">
        <path d={LEAF} transform="rotate(-30 120 120)" />
        <path d={LEAF} transform="translate(96 70) scale(.55) rotate(40 120 120)" />
        <path d={LEAF} transform="translate(10 120) scale(.42) rotate(-70 120 120)" />
      </svg>
    );
  }
  return <span className={`zn-motif zn-motif-${k}`} aria-hidden="true" />;
}

function Cta({ ad, className = "zn-cta", fallback = "Shop now" }: { ad: ServedAd; className?: string; fallback?: string }) {
  return (
    <a className={className} href={ad.clickUrl} rel="sponsored">
      {ad.ctaLabel || fallback}
      <Icon name="arrow" />
    </a>
  );
}

const brandName = (ad: ServedAd) => (ad.isHouse ? "The Big Brands" : ad.brand?.name ?? "Brand partner");

// ───────────────────────────── H1 · hero billboard ─────────────────────────────

function heroSlide(ad: ServedAd, k: number): HeroSlide {
  const th = themeOf(ad.theme, ad.brand);
  const ps = ad.products.slice(0, 3);
  const main = ps[0];
  const off = main ? discountOf(main) : 0;
  const word = ad.isHouse ? "free gift" : ad.brand?.word || ad.brand?.name || "";
  const hasImg = !!ad.imageUrl;
  const content = (
    <>
      <div className={cx("zn-slide-bg", hasImg && "has-img")} aria-hidden="true">
        {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} mobileSrc={ad.mobileImageUrl} alt="" eager={k === 0} className="zn-slide-img" /> : null}
      </div>
      {ad.brand ? (
        <span className="zn-wm" aria-hidden="true" style={wordmarkStyle(ad.brand, word)}>
          {word}
        </span>
      ) : null}
      <div className="wrap zn-slide-in">
        <div className="zn-copy">
          {ad.brand ? (
            <a className="zn-copy-logo" href={ad.clickUrl} rel="sponsored" aria-label={ad.isHouse ? "TBB Originals" : ad.brand.name} tabIndex={-1}>
              <BrandLogo brand={ad.brand} size={22} color={th.fg} />
            </a>
          ) : null}
          {kickerOf(ad.kicker) ? <span className="zn-kick">{kickerOf(ad.kicker)}</span> : null}
          <h2 className="zn-head" style={headStyle(ad.brand)}>
            <SwashHeadline parts={splitHeadline(ad.headline)} />
          </h2>
          {ad.subline ? <p className="zn-sub">{ad.subline}</p> : null}
          <Cta ad={ad} />
        </div>
        {ps.length ? (
          <div className={`zn-stage n${ps.length}`}>
            <span className="zn-halo" aria-hidden="true" />
            <span className="zn-ring" aria-hidden="true" />
            <span className="zn-ring zn-ring-2" aria-hidden="true" />
            {ps.map((p, j) => (
              <a key={p.id} className={`zn-pk zn-pk-${j + 1}`} href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored" aria-label={`${p.brand.name} ${p.name}`} tabIndex={-1}>
                <ZnVisual product={p} sizes="(max-width: 760px) 40vw, 300px" eager={k === 0 && j === 0} />
              </a>
            ))}
            {ad.isHouse ? (
              <span className="zn-sticker" aria-hidden="true">
                <b>FREE</b>
                <small>with every order</small>
              </span>
            ) : main ? (
              <span className="zn-sticker" aria-hidden="true">
                <small>Now</small>
                <b>{rupees(main.price)}</b>
                {off > 0 ? <small>{off}% off</small> : null}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="zn-stage zn-stage-mono">
            <span className="zn-halo" aria-hidden="true" />
            {ad.brand ? (
              <a className="zn-mono" href={ad.clickUrl} rel="sponsored" aria-label={ad.brand.name} tabIndex={-1}>
                <BrandLogo brand={ad.brand} size={60} color={th.fg} />
              </a>
            ) : null}
          </div>
        )}
      </div>
      <div className="wrap zn-slide-tag">
        <ZnTag ad={ad} />
      </div>
    </>
  );
  return {
    key: ad.id,
    trackId: ad.id,
    tab: ad.isHouse ? "Free gifts" : ad.brand?.name ?? ad.headline.slice(0, 18),
    label: brandName(ad),
    fg: th.fg,
    className: cx(!th.light && "is-lt", hasImg && "has-photo"),
    style: themeVars(th),
    content,
  };
}

export function HeroZone({ ads, slot, className }: { ads: ServedAd[]; slot: ZoneSlot; className?: string }) {
  const list = ads.slice(0, 5);
  return (
    <PzSlot slot={slotInfo(slot)} as="section" className={cx("zn-hero", className)} aria-roledescription="carousel" aria-label="Featured brand offers">
      <HeroCarousel slides={list.map(heroSlide)} />
    </PzSlot>
  );
}

// ───────────────────────────── H2 · spotlight cards ─────────────────────────────

function SpotCard({ ad }: { ad: ServedAd }) {
  const b = ad.brand;
  const t = ad.theme ?? {};
  const ps = ad.products.slice(0, 3);
  const tint = t.bg && !/gradient/i.test(t.bg) && isHex(t.bg) ? t.bg : `color-mix(in srgb, ${b?.accent && isHex(b.accent) ? b.accent : "#e7e4ee"} 45%, #fff)`;
  const ac = isHex(t.accent) && contrast(t.accent, "#ffffff") >= 3 ? t.accent : b && isHex(b.color) && contrast(b.color, "#ffffff") >= 3 ? b.color : "#17121f";
  const ink = isHex(t.fg) && contrast(t.fg, "#ffffff") >= 4.5 ? t.fg : "#17121f";
  return (
    <article className="zn-sp" style={{ "--sp-tint": tint, "--sp-ac": ac, "--sp-ink": ink } as CSSProperties} {...trackProps(ad)}>
      <div className="zn-sp-top">
        {b ? (
          <a className="zn-sp-logo" href={ad.clickUrl} rel="sponsored" aria-label={`${b.name} store`}>
            <BrandLogo brand={b} size={17} />
          </a>
        ) : (
          <span />
        )}
        {ad.isHouse ? <HouseTag /> : <SpLabel />}
      </div>
      <h3 className="zn-sp-h">
        <a href={ad.clickUrl} rel="sponsored">
          {ad.headline}
        </a>
      </h3>
      {ad.subline ? <p className="zn-sp-sub">{ad.subline}</p> : null}
      {ps.length ? (
        <div className={`zn-sp-pks n${ps.length}`}>
          {ps.map((p) => (
            <a key={p.id} className="zn-sp-pk" href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored">
              <span className="zn-sp-art">
                <ZnVisual product={p} sizes="140px" blend />
              </span>
              <span className="zn-sp-nm">{shortName(p.name)}</span>
              <b>{rupees(p.price)}</b>
            </a>
          ))}
        </div>
      ) : b ? (
        <a className="zn-sp-pks zn-sp-mono" href={ad.clickUrl} rel="sponsored" aria-label={`${b.name} store`}>
          <BrandLogo brand={b} size={38} />
        </a>
      ) : null}
      <Cta ad={ad} className="zn-sp-cta" />
    </article>
  );
}

export function SpotlightZone({ ads, slot, className }: { ads: ServedAd[]; slot: ZoneSlot; className?: string }) {
  return (
    <div className={cx("wrap zn-spot-wrap", className)}>
      <div className="zn-spot">
        {ads.slice(0, 4).map((ad) => (
          <PzSlot key={ad.id} slot={slotInfo(slot)} className="zn-spot-slot">
            <SpotCard ad={ad} />
          </PzSlot>
        ))}
      </div>
      <p className="zn-pnote">
        <Icon name="info" />
        <span>Sponsored placements from brand partners help keep prices low.</span>
        <Link href="/advertise" prefetch={false}>
          Advertise on The Big Brands
          <Icon name="arrow" />
        </Link>
      </p>
    </div>
  );
}

// ───────────────────────────── H3 · leaderboard strip ─────────────────────────────

export function LeaderboardZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const th = themeOf(ad.theme, ad.brand);
  const ps = ad.products.slice(0, 3);
  return (
    <section className={cx("wrap zn-sec zn-lb-sec", className)} aria-label={`${ad.isHouse ? "Promotion" : "Sponsored"}: ${brandName(ad)}`}>
      <PzSlot slot={slotInfo(slot)} className="zn-lb-slot">
        <div className={cx("zn-lb", ad.imageUrl && "has-img")} style={themeVars(th)} {...trackProps(ad)}>
          <span className="zn-lb-fx" aria-hidden="true">
            {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} mobileSrc={ad.mobileImageUrl} alt="" sizes="(max-width: 760px) 100vw, 1500px" className="zn-lb-img" /> : null}
          </span>
          <div className="zn-lb-copy">
            {ad.brand ? (
              <a className="zn-lb-logo" href={ad.clickUrl} rel="sponsored" aria-label={ad.brand.name} tabIndex={-1}>
                <BrandLogo brand={ad.brand} size={26} color={th.fg} />
              </a>
            ) : null}
            <div>
              {kickerOf(ad.kicker) ? <span className="zn-lb-kick">{kickerOf(ad.kicker)}</span> : null}
              <h3 style={headStyle(ad.brand)}>
                <a href={ad.clickUrl} rel="sponsored">
                  {ad.headline}
                </a>
              </h3>
              {ad.subline ? <p>{ad.subline}</p> : null}
            </div>
          </div>
          <div className={`zn-lb-pks n${ps.length}`}>
            {ps.map((p, j) => (
              <a key={p.id} className={`zn-lb-pk zn-lb-pk-${j + 1}`} href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored" aria-label={`${p.brand.name} ${p.name}`} tabIndex={-1}>
                <ZnVisual product={p} sizes="180px" />
              </a>
            ))}
          </div>
          <div className="zn-lb-end">
            <ZnTag ad={ad} compact />
            <Cta ad={ad} />
          </div>
        </div>
      </PzSlot>
    </section>
  );
}

// ───────────────────────────── H4 · shop by concern ─────────────────────────────

const CN_STYLE: Record<string, [string, string, string]> = {
  hairfall: ["#f1e8ff", "#d6bfff", "#3b1a66"],
  acne: ["#def6ef", "#ade6d6", "#0b4a40"],
  dandruff: ["#e8f2ff", "#c2d9fb", "#12355e"],
  dull: ["#fff4d6", "#ffd47f", "#573800"],
  tan: ["#ffeadb", "#ffbb90", "#6b2a00"],
  dry: ["#e2f6fd", "#ade0f4", "#0b4660"],
  frizz: ["#ffe7ef", "#ffbcd0", "#6b1030"],
  darkcircles: ["#eeebfa", "#cec6ee", "#2e2659"],
  beard: ["#f6ece1", "#dfc09e", "#4a2c12"],
};
const CN_IC: Record<string, string> = {
  hairfall: '<path d="M4 9.5h16v3H4z"/><path d="M6.5 12.5v4M9.5 12.5v5.5M12.5 12.5v4M15.5 12.5v5.5M18 12.5v4"/><path d="M8 3c1.2 2 3 2.3 3.6 5M15.5 3c-.8 1.8-.8 3.2 0 5"/>',
  acne: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.1"/><circle cx="15" cy="14.2" r="1.4"/><circle cx="10" cy="15.6" r=".8"/><circle cx="15.6" cy="8.8" r=".8"/>',
  dandruff: '<path d="M12 2.5v19M4 7l16 10M4 17 20 7"/><path d="m9.2 4.2 2.8 2 2.8-2M9.2 19.8l2.8-2 2.8 2"/>',
  dull: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  tan: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  dry: '<path d="M12 2.8s7 7.2 7 12.2a7 7 0 0 1-14 0c0-5 7-12.2 7-12.2z"/><path d="M9 15.2a3 3 0 0 0 3 3"/>',
  frizz: '<path d="M3 7.5c3-3 5 3 8 0s5 3 8 0M3 12.5c3-3 5 3 8 0s5 3 8 0M3 17.5c3-3 5 3 8 0s5 3 8 0"/>',
  darkcircles: '<path d="M2 11s3.6-5 10-5 10 5 10 5-3.6 5-10 5S2 11 2 11z"/><circle cx="12" cy="11" r="2.5"/><path d="M6 19.2c3.5 1.5 8.5 1.5 12 0"/>',
  beard: '<path d="M5 5v4.5C5 15 8 19.5 12 19.5S19 15 19 9.5V5"/><path d="M8.5 12.5c2-1.3 5-1.3 7 0"/><path d="M12 19.5V22"/>',
};

function ConcernTileView({ c, sponsored }: { c: ConcernTile; sponsored: boolean }) {
  const [c1, c2, ink] = CN_STYLE[c.slug] ?? ["#f4f3f8", "#e2def0", "#17121f"];
  const href = `/s?concern=${encodeURIComponent(c.slug)}`;
  const inner = (
    <>
      <span className="zn-cn-ic" aria-hidden="true">
        {/* constant icon markup from the map above (never user data) */}
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: CN_IC[c.slug] ?? CN_IC.dull }} />
      </span>
      <b className="zn-cn-name">{c.name}</b>
      <span className="zn-cn-n">
        {c.fromPrice ? `from ${rupees(c.fromPrice)}` : "Shop the edit"}
        <Icon name="chevRight" />
      </span>
      {c.product ? (
        <span className="zn-cn-art" aria-hidden="true">
          <ZnVisual product={c.product} sizes="80px" blend />
        </span>
      ) : null}
      {sponsored && c.sponsor ? (
        <span className="zn-cn-by">
          <small>Presented by</small>
          <BrandLogo brand={c.sponsor} size={12} showSub={false} />
        </span>
      ) : null}
    </>
  );
  const style = { "--c1": c1, "--c2": c2, "--ink": ink } as CSSProperties;
  // a paid sponsorship links through the click tracker; the default sponsor is a plain link
  return sponsored && c.ad ? (
    <a className="zn-cn" href={trackedHref(c.ad, href)} rel="sponsored" style={style} {...trackProps(c.ad)}>
      {inner}
    </a>
  ) : (
    <Link className="zn-cn" href={href} style={style} prefetch={false}>
      {inner}
    </Link>
  );
}

export function ConcernsZone({ tiles, slot, className }: { tiles: ConcernTile[]; slot: ZoneSlot | null; className?: string }) {
  const paused = !slot || !slot.isActive;
  return (
    <section className={cx("wrap zn-sec", className)} aria-labelledby="zn-cn-h">
      <div className="blk zn-blk">
        <ZnHead
          id="zn-cn-h"
          title="Shop by concern"
          kick="Expert edits"
          kickIcon="target"
          sub={paused ? "Pick your goal and shop the edit" : "Pick your goal — each edit is presented by a partner brand"}
          right={
            <>
              {!paused ? <SpLabel text="Sponsored edits" /> : null}
              <Link className="link" href="/s" prefetch={false}>
                All products
                <Icon name="chevRight" />
              </Link>
            </>
          }
        />
        <div className="zn-cns">
          {tiles.map((c) =>
            paused || !c.sponsor ? (
              <div key={c.slug} className="zn-cn-cell">
                <ConcernTileView c={c} sponsored={false} />
              </div>
            ) : (
              <PzSlot key={c.slug} slot={slotInfo(slot)} className="zn-cn-cell">
                <ConcernTileView c={c} sponsored />
              </PzSlot>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── H5 · video billboard ─────────────────────────────

function sceneList(ad: ServedAd): VideoScene[] {
  const th = themeOf(ad.theme, ad.brand);
  const hs = headStyle(ad.brand);
  const ps = ad.products.slice(0, 2);
  const p1 = ps[0];
  const p2 = ps[1] ?? ps[0];
  const parts = String(ad.subline || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  const name = brandName(ad);
  const l1 = p1 ? shortName(p1.name) : ad.kicker || name;
  const l2 = parts[1] || (p2 && p2 !== p1 ? shortName(p2.name) : ad.subline || ad.headline);

  // advertiser-supplied scene photos (meta.scenes: string[] | {image, caption}[]) play as a slideshow
  const raw = Array.isArray(ad.meta.scenes) ? (ad.meta.scenes as unknown[]) : [];
  const photos = raw
    .map((s) => (typeof s === "string" ? { image: s, caption: "" } : s && typeof s === "object" ? { image: String((s as { image?: unknown }).image ?? ""), caption: String((s as { caption?: unknown }).caption ?? "") } : null))
    .filter((s): s is { image: string; caption: string } => !!s && /^(\/|https:\/\/)/.test(s.image))
    .slice(0, 5);
  if (photos.length) {
    return [
      ...photos.map((s, k) => ({
        cc: s.caption || (k === 0 ? parts[0] || ad.headline : parts[k] || ad.headline),
        content: (
          <>
            <div className={cx("zn-kb zn-kb-photo", k % 2 && "zn-kb-2")}>
              <ZnPhoto src={s.image} alt="" sizes="(max-width: 960px) 100vw, 960px" className="zn-kb-img" />
            </div>
            {k === 0 ? (
              <div className="zn-v-txt">
                <small>{name} presents</small>
                <b style={hs}>{l1}</b>
              </div>
            ) : null}
          </>
        ),
      })),
      {
        cc: ad.headline,
        content: (
          <>
            <div className="zn-kb zn-kb-3" />
            <div className="zn-v-end">
              {ad.brand ? <BrandLogo brand={ad.brand} size={24} color={th.fg} /> : null}
              <b style={hs}>{ad.headline}</b>
              <span className="zn-v-pks">
                {p1 ? <span className="zn-v-pk a"><ZnVisual product={p1} sizes="200px" /></span> : null}
                {p2 && p2 !== p1 ? <span className="zn-v-pk b"><ZnVisual product={p2} sizes="200px" /></span> : null}
              </span>
            </div>
          </>
        ),
      },
    ];
  }

  const pk = (p: ProductCardData | undefined, cls: string) =>
    p ? (
      <span className={`zn-v-pk ${cls}`}>
        <ZnVisual product={p} sizes="(max-width: 760px) 50vw, 320px" />
      </span>
    ) : null;
  return [
    {
      cc: parts[0] || l1,
      content: (
        <>
          <div className="zn-kb" />
          {pk(p1, "r")}
          <div className="zn-v-txt">
            <small>{name} presents</small>
            <b style={hs}>{l1}</b>
          </div>
        </>
      ),
    },
    {
      cc: parts[1] || l2,
      content: (
        <>
          <div className="zn-kb zn-kb-2" />
          {pk(p2, "l")}
          <div className="zn-v-txt is-r">
            <small>{p2 && p2 !== p1 ? shortName(p2.name) : "All day, every day"}</small>
            <b style={hs}>{l2}</b>
          </div>
        </>
      ),
    },
    {
      cc: ad.headline,
      content: (
        <>
          <div className="zn-kb zn-kb-3" />
          <div className="zn-v-end">
            {ad.brand ? <BrandLogo brand={ad.brand} size={24} color={th.fg} /> : null}
            <b style={hs}>{ad.headline}</b>
            <span className="zn-v-pks">
              {pk(p1, "a")}
              {p2 && p2 !== p1 ? pk(p2, "b") : null}
            </span>
          </div>
        </>
      ),
    },
  ];
}

export function VideoZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const th = themeOf(ad.theme, ad.brand);
  const ps = ad.products.slice(0, 2);
  return (
    <section className={cx("wrap zn-sec", className)} aria-label={`Video: ${ad.headline}`}>
      <PzSlot slot={slotInfo(slot)} className="zn-vid-slot">
        <div className="zn-vid">
          <VideoPlayer
            trackId={ad.id}
            style={themeVars(th)}
            scenes={sceneList(ad)}
            videoUrl={ad.videoUrl}
            poster={ad.imageUrl}
            tag={<ZnTag ad={ad} />}
            ctaHref={ad.clickUrl}
            ctaLabel={ad.ctaLabel || "Shop now"}
            title={ad.headline}
          />
          <div className="zn-vside">
            <div className="zn-vside-top">
              {ad.brand ? (
                <a href={ad.clickUrl} rel="sponsored" aria-label={ad.brand.name}>
                  <BrandLogo brand={ad.brand} size={22} />
                </a>
              ) : (
                <span />
              )}
              {ad.isHouse ? <HouseTag /> : <SpLabel text="Sponsored video" />}
            </div>
            <span className="zn-h-k">
              <Icon name="play" />
              {kickerOf(ad.kicker) || "Watch"}
            </span>
            <h3>{ad.headline}</h3>
            {ad.subline ? <p>{ad.subline}</p> : null}
            {ps.length ? (
              <div className="zn-vps">
                <span className="zn-vps-h">In this video</span>
                {ps.map((p) => (
                  <div key={p.id} className="zn-vp">
                    <a className="zn-vp-art" href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored" style={{ "--tint": productTint(p) } as CSSProperties} aria-label={p.name}>
                      <ZnVisual product={p} sizes="56px" blend />
                    </a>
                    <div className="zn-vp-txt">
                      <a href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored">
                        {p.name}
                      </a>
                      {p.reviewCount > 0 ? (
                        <span>
                          <Stars rating={p.rating} />
                          <small>{p.reviewCount.toLocaleString("en-IN")}</small>
                        </span>
                      ) : null}
                      <b>
                        {rupees(p.price)} {p.mrp > p.price ? <s>{rupees(p.mrp)}</s> : null}
                      </b>
                    </div>
                    <AddToCartButton productId={p.id} outOfStock={p.stock <= 0} className="btn btn-sm btn-cart" label={<><Icon name="plus" />Add</>} soldOutLabel="Sold out" />
                  </div>
                ))}
              </div>
            ) : null}
            <p className="zn-vnote">
              <Icon name="gift" />
              <span>
                Shop the look and pick a <b>free TBB Originals gift</b> at checkout
              </span>
            </p>
            <a className="btn btn-dark btn-lg zn-vside-cta" href={ad.clickUrl} rel="sponsored">
              {ad.ctaLabel || "Shop now"}
              <Icon name="arrow" />
            </a>
          </div>
        </div>
      </PzSlot>
    </section>
  );
}

// ───────────────────────────── H6 · creator reels ─────────────────────────────

function ReelCard({ ad }: { ad: ServedAd }) {
  const p = ad.products[0];
  if (!p) return null;
  const m = ad.meta as { creator?: string; handle?: string; views?: string; colors?: unknown };
  const cols = (Array.isArray(m.colors) ? m.colors : []).filter(isHex);
  const handle = m.handle || "@thebigbrands";
  const views = m.views || "";
  const initial = String(m.creator || handle).replace(/^Dr\.\s*/, "").replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const b = ad.brand;
  return (
    <a
      className="zn-reel"
      href={trackedHref(ad, ad.linkUrl && ad.linkUrl !== `/brand/${b?.slug}` ? ad.linkUrl : `/p/${p.slug}`)}
      rel="sponsored"
      style={{ "--a": cols[0] ?? "#3a2a55", "--b": cols[1] ?? "#140a24" } as CSSProperties}
      aria-label={`${ad.headline} by ${handle}${views ? `, ${views} views` : ""}. Paid partnership with ${brandName(ad)}. Shop ${p.name}`}
      {...trackProps(ad)}
    >
      {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} alt="" sizes="(max-width: 760px) 46vw, 240px" className="zn-reel-img" /> : null}
      <span className="zn-reel-seg" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="zn-reel-top">
        <span className="zn-reel-av">
          <span>{initial}</span>
        </span>
        <span className="zn-reel-id">
          <b>{handle}</b>
          <small>{ad.isHouse ? "The Big Brands" : `Paid partnership with ${b?.name ?? "a brand"}`}</small>
        </span>
      </span>
      {!ad.imageUrl ? (
        <span className="zn-reel-art">
          <ZnVisual product={p} sizes="160px" />
        </span>
      ) : null}
      <span className="zn-reel-play" aria-hidden="true">
        <Icon name="play" />
      </span>
      <span className="zn-reel-foot">
        <span className="zn-reel-t">{ad.headline}</span>
        {views ? (
          <span className="zn-reel-meta">
            <Icon name="play" />
            {views} views
          </span>
        ) : null}
        <span className="zn-reel-shop">
          <span className="zn-reel-mini">
            <ZnVisual product={p} sizes="34px" blend />
          </span>
          <span className="zn-reel-pn">
            <b>{shortName(p.name)}</b>
            <small>{rupees(p.price)}</small>
          </span>
          <em>Shop</em>
        </span>
      </span>
    </a>
  );
}

export function ReelsZone({ ads, slot, className }: { ads: ServedAd[]; slot: ZoneSlot; className?: string }) {
  const list = ads.filter((a) => a.products.length).slice(0, 6);
  if (!list.length) return null;
  return (
    <section className={cx("wrap zn-sec", className)} aria-labelledby="zn-rl-h">
      <div className="blk zn-blk">
        <ZnHead id="zn-rl-h" title="Creator reels you can shop" kick="Shoppable video" kickIcon="play" sub="Real routines from creators you follow — tap a reel to shop the product" right={<SpLabel text="Paid partnerships" />} />
        <div className="zn-reels">
          {list.map((ad) => (
            <PzSlot key={ad.id} slot={slotInfo(slot)} className="zn-reel-slot">
              <ReelCard ad={ad} />
            </PzSlot>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── H7 · featured brand stores ─────────────────────────────

function StoreTileView({ t }: { t: StoreTile }) {
  const b = t.brand;
  const wl = String(b.word || b.name).length;
  const href = `/brand/${b.slug}`;
  const inner = (
    <>
      <span className="zn-st-top">
        <span className="zn-st-logo">
          <BrandLogo brand={b} size={wl >= 12 ? 14 : wl >= 10 ? 16 : 18} />
        </span>
        <span className="zn-st-pks" aria-hidden="true">
          {t.products.map((p) => (
            <span key={p.id}>
              <ZnVisual product={p} sizes="60px" blend />
            </span>
          ))}
        </span>
      </span>
      <span className="zn-st-meta">
        <b>{b.tagline || b.name}</b>
        <small className="zn-st-ok">
          <Icon name="check" />
          Official store
        </small>
        {t.bestOff > 0 ? <small className="zn-st-off">Up to {t.bestOff}% off</small> : null}
        <em>
          Visit store
          <Icon name="arrow" />
        </em>
      </span>
    </>
  );
  const style = { "--ba": b.accent && isHex(b.accent) ? b.accent : "#f4f3f8" } as CSSProperties;
  return t.ad ? (
    <a className="zn-st" href={trackedHref(t.ad, href)} rel="sponsored" style={style} {...trackProps(t.ad)}>
      {inner}
    </a>
  ) : (
    <Link className="zn-st" href={href} style={style} prefetch={false}>
      {inner}
    </Link>
  );
}

export function StoresZone({ tiles, slot, className }: { tiles: StoreTile[]; slot: ZoneSlot; className?: string }) {
  if (!tiles.length) return null;
  return (
    <section className={cx("wrap zn-sec", className)} aria-labelledby="zn-st-h">
      <div className="blk zn-blk">
        <ZnHead
          id="zn-st-h"
          title="Featured brand stores"
          kick="Official stores"
          kickIcon="store"
          sub="Shop straight from the brands — 100% authentic, sourced direct"
          right={
            <>
              <SpLabel text="Featured stores · Sponsored" />
              <Link className="link" href="/brands" prefetch={false}>
                All brands
                <Icon name="chevRight" />
              </Link>
            </>
          }
        />
        <div className="zn-stores">
          {tiles.map((t) => (
            <PzSlot key={t.brand.id} slot={slotInfo(slot)} className="zn-st-slot">
              <StoreTileView t={t} />
            </PzSlot>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── H8 · double billboard ─────────────────────────────

function BillboardCard({ ad }: { ad: ServedAd }) {
  const th = themeOf(ad.theme, ad.brand);
  const ps = ad.products.slice(0, 2);
  return (
    <div className={cx("zn-bb", ad.imageUrl && "has-img")} style={themeVars(th)} {...trackProps(ad)}>
      {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} mobileSrc={ad.mobileImageUrl} alt="" sizes="(max-width: 960px) 100vw, 740px" className="zn-bb-img" /> : <Motif slug={ad.brand?.slug} />}
      <div className="zn-bb-copy">
        {ad.brand ? (
          <a className="zn-bb-logo" href={ad.clickUrl} rel="sponsored" aria-label={ad.brand.name} tabIndex={-1}>
            <BrandLogo brand={ad.brand} size={22} color={th.fg} />
          </a>
        ) : null}
        {kickerOf(ad.kicker) ? <span className="zn-kick">{kickerOf(ad.kicker)}</span> : null}
        <h3 className="zn-bb-h" style={headStyle(ad.brand)}>
          <a href={ad.clickUrl} rel="sponsored">
            <SwashHeadline parts={splitHeadline(ad.headline)} />
          </a>
        </h3>
        {ad.subline ? <p>{ad.subline}</p> : null}
        <Cta ad={ad} />
      </div>
      {ad.imageUrl && ps.length ? (
        // With a campaign photo the photo is the hero: products appear as small shoppable cards on top of it
        // (a full-size packshot over a lifestyle photo looked pasted on).
        <div className={`zn-bb-chips n${ps.length}`}>
          {ps.map((p) => {
            const off = discountOf(p);
            return (
              <a key={p.id} className="zn-bb-chip" href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored" aria-label={`${p.brand.name} ${p.name}, ${rupees(p.price)}`}>
                <span className="zn-bb-chip-art" aria-hidden="true">
                  <ZnVisual product={p} sizes="56px" />
                </span>
                <span className="zn-bb-chip-t">
                  <b>{shortName(p.name)}</b>
                  <small>
                    {rupees(p.price)}
                    {off > 0 ? <em>{off}% off</em> : null}
                  </small>
                </span>
                <Icon name="arrow" />
              </a>
            );
          })}
        </div>
      ) : (
      <div className={`zn-bb-art n${ps.length}`}>
        <span className="zn-halo" aria-hidden="true" />
        {ps.length ? (
          ps.map((p, j) => (
            <a key={p.id} className={`zn-bb-pk zn-bb-pk-${j + 1}`} href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored" aria-label={`${p.brand.name} ${p.name}`} tabIndex={-1}>
              <ZnVisual product={p} sizes="240px" />
            </a>
          ))
        ) : ad.brand ? (
          <a className="zn-mono" href={ad.clickUrl} rel="sponsored" aria-label={ad.brand.name} tabIndex={-1}>
            <BrandLogo brand={ad.brand} size={44} color={th.fg} />
          </a>
        ) : null}
      </div>
      )}
      <span className="zn-bb-tag">
        <ZnTag ad={ad} compact />
      </span>
    </div>
  );
}

export function DoubleBillboardZone({ ads, slot, className }: { ads: ServedAd[]; slot: ZoneSlot; className?: string }) {
  return (
    <section className={cx("wrap zn-sec", className)} aria-label="Brand offers">
      <div className={cx("zn-bbs", ads.length === 1 && "is-one")}>
        {ads.slice(0, 2).map((ad) => (
          <PzSlot key={ad.id} slot={slotInfo(slot)} className="zn-bb-slot">
            <BillboardCard ad={ad} />
          </PzSlot>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────── H9 · brand coupon wall ─────────────────────────────

export function CouponWallZone({ coupons, slot, className }: { coupons: WallCoupon[]; slot: ZoneSlot; className?: string }) {
  if (!coupons.length) return null;
  const list = coupons.slice(0, slot.positions || 8);
  return (
    <section className={cx("wrap zn-sec", className)} aria-labelledby="zn-cp-h">
      <div className="blk zn-blk zn-cpwall">
        <ZnHead
          id="zn-cp-h"
          title="Brand coupon wall"
          kick="Clip & save"
          kickIcon="scissors"
          sub="Clip a coupon now — it’s applied automatically at checkout"
          right={
            <>
              <ClipCount ids={list.map((c) => c.id)} />
              <SpLabel text="Sponsored coupons" />
            </>
          }
        />
        <div className="zn-cps">
          {list.map((c) => {
            const b = c.brand;
            const label = `${b?.name ?? "Brand"} ${c.title}`;
            const min = c.description || (c.minOrder > 0 ? `on ₹${c.minOrder.toLocaleString("en-IN")}+` : "on any order");
            return (
              <PzSlot key={c.id} slot={slotInfo(slot)} className="zn-cp-slot">
                <div className="zn-cp" style={{ "--bc": b && isHex(b.color) ? b.color : "#333", "--ba": b?.accent && isHex(b.accent) ? b.accent : "#f4f3f8" } as CSSProperties}>
                  {b ? (
                    <Link className="zn-cp-stub" href={`/brand/${b.slug}`} aria-label={`${b.name} store`} prefetch={false}>
                      <BrandLogo brand={b} size={(b.word || b.name).length >= 9 ? 12 : 15} />
                    </Link>
                  ) : (
                    <span className="zn-cp-stub" />
                  )}
                  <div className="zn-cp-body">
                    <b className="zn-cp-val">{c.title}</b>
                    <span className="zn-cp-min">
                      {min}
                      {b ? ` · ${b.name}` : ""}
                    </span>
                    <span className={cx("zn-cp-exp", c.expiresSoon && "is-soon")}>
                      <Icon name="clock" />
                      {c.expiresLabel}
                    </span>
                    <ClipButton couponId={c.id} label={label} />
                  </div>
                  <span className="zn-cp-stamp" aria-hidden="true">
                    Clipped
                  </span>
                </div>
              </PzSlot>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── H10 · sponsored deal of the day ─────────────────────────────

export function DealZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const p = ad.products[0];
  if (!p) return null;
  const th = themeOf(ad.theme, ad.brand);
  const b = ad.brand;
  const dealPrice = Number(ad.meta.dealPrice);
  const price = dealPrice > 0 && dealPrice < p.price ? Math.round(dealPrice) : p.price;
  const pct = p.mrp > price ? Math.round((1 - price / p.mrp) * 100) : 0;
  const ink = contrast(th.ac, "#ffffff") >= 3 ? th.ac : b && isHex(b.color) && contrast(b.color, "#ffffff") >= 3 ? b.color : "#d6234f";
  const kicker = kickerOf(ad.kicker) ?? "Sponsored Deal of the Day";
  const claimed = typeof ad.meta.claimedPct === "number" ? Math.max(1, Math.min(99, ad.meta.claimedPct as number)) : 0;
  const lightMedia = lum(th.s0) > 0.6;
  return (
    <PzSlot slot={slotInfo(slot)} className={cx("zn-deal-slot", className)}>
      <div className="zn-deal" style={themeVars(th, { "--zn-ink": ink })} {...trackProps(ad)}>
        <div className="zn-deal-media">
          {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} alt="" sizes="(max-width: 760px) 100vw, 520px" className="zn-deal-img" /> : null}
          <span className="zn-deal-rib">
            <Icon name="zap" />
            Deal of the Day
          </span>
          {pct > 0 ? (
            <span className="zn-deal-burst" aria-hidden="true">
              <b>{pct}%</b>off
            </span>
          ) : null}
          <span className="zn-deal-pod" aria-hidden="true" />
          <a className="zn-deal-pk" href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored" aria-label={`${p.brand.name} ${p.name}`} tabIndex={-1}>
            <ZnVisual product={p} sizes="(max-width: 760px) 150px, 250px" blend={lightMedia && !ad.imageUrl} />
          </a>
        </div>
        <div className="zn-deal-body">
          <div className="zn-deal-top">
            {b ? (
              <Link href={`/brand/${b.slug}`} aria-label={`${b.name} store`} prefetch={false}>
                <BrandLogo brand={b} size={20} />
              </Link>
            ) : (
              <span />
            )}
            <ZnTag ad={ad} compact />
          </div>
          <span className="zn-deal-k">{kicker}</span>
          <h3 className="zn-deal-h">
            <a href={ad.clickUrl} rel="sponsored">
              {ad.headline}
            </a>
          </h3>
          {p.reviewCount > 0 ? (
            <div className="zn-deal-rate">
              <Stars rating={p.rating} />
              <b>{p.rating.toFixed(1)}</b>
              <span>({p.reviewCount.toLocaleString("en-IN")} ratings)</span>
            </div>
          ) : null}
          <div className="zn-deal-price">
            <span className="zn-deal-now">
              <sup>₹</sup>
              {price.toLocaleString("en-IN")}
            </span>
            {p.mrp > price ? (
              <span className="zn-deal-mrp">
                M.R.P: <s>{rupees(p.mrp)}</s>
              </span>
            ) : null}
            {pct ? <span className="zn-deal-off">{pct}% off</span> : null}
          </div>
          {ad.subline ? (
            <p className="zn-deal-sub">
              <Icon name="tag" />
              <span>
                {ad.subline} · <b>+ a free TBB gift</b>
              </span>
            </p>
          ) : null}
          <p className="zn-deal-del">
            <Icon name="truck" />
            <span>
              FREE delivery <DeliveryDate days={3} />
            </span>
          </p>
          <Countdown />
          {claimed > 0 ? (
            <div className="zn-claim">
              <div className="zn-claim-bar">
                <i style={{ "--w": `${claimed}%` } as CSSProperties} />
              </div>
              <span>
                <b>{claimed}%</b> claimed
              </span>
            </div>
          ) : null}
          <div className="zn-deal-btns">
            <AddToCartButton productId={p.id} outOfStock={p.stock <= 0} className="btn btn-cart btn-lg" label={<><Icon name="cart" />Add to cart</>} />
            <a className="btn btn-ghost btn-lg" href={trackedHref(ad, `/p/${p.slug}`)} rel="sponsored">
              View deal
            </a>
          </div>
        </div>
      </div>
    </PzSlot>
  );
}

// ───────────────────────────── H11 · sponsored brand shelf ─────────────────────────────

export function ShelfZone({ ad, slot, className }: { ad: ServedAd; slot: ZoneSlot; className?: string }) {
  const th = themeOf(ad.theme, ad.brand);
  const b = ad.brand;
  const ps = ad.products.slice(0, 4);
  return (
    <section className={cx("wrap zn-sec", className)} aria-label={`${ad.isHouse ? "Promotion" : "Sponsored brand"}: ${brandName(ad)}`}>
      <PzSlot slot={slotInfo(slot)} className="zn-shelf-slot">
        <div className="zn-shelf" {...trackProps(ad)}>
          <div className={cx("zn-shelf-hero", ad.imageUrl && "has-img")} style={themeVars(th)}>
            {ad.imageUrl ? <ZnPhoto src={ad.imageUrl} alt="" sizes="(max-width: 960px) 100vw, 400px" className="zn-shelf-img" /> : <Motif slug={b?.slug} />}
            <div className="zn-shelf-top">{ad.isHouse ? <HouseTag /> : <SpLabel text="Sponsored brand" />}</div>
            {b ? (
              <a href={ad.clickUrl} rel="sponsored" aria-label={b.name}>
                <BrandLogo brand={b} size={34} color={th.fg} />
              </a>
            ) : null}
            <h3 style={headStyle(b)}>{ad.headline}</h3>
            {ad.subline ? <p>{ad.subline}</p> : null}
            <Cta ad={ad} fallback="Visit store" />
            {!ad.imageUrl ? (
              <div className="zn-shelf-fan" aria-hidden="true">
                {ps.slice(0, 3).map((p) => (
                  <span key={p.id}>
                    <ZnVisual product={p} sizes="110px" />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="zn-shelf-grid">
            {ps.map((p) => (
              <ProductCard key={p.id} product={p} compact sponsored href={trackedHref(ad, `/p/${p.slug}`)} sizes="(max-width: 760px) 46vw, 240px" />
            ))}
            {ps.length < 4 && b ? (
              <a className="zn-shelf-more" href={ad.clickUrl} rel="sponsored" style={{ "--ba": b.accent && isHex(b.accent) ? b.accent : "#f4f3f8" } as CSSProperties}>
                <BrandLogo brand={b} size={22} />
                <b>Explore the full {b.name} store</b>
                <small>Combos, minis &amp; new launches</small>
                <span>
                  {ad.ctaLabel || "Visit store"}
                  <Icon name="arrow" />
                </span>
              </a>
            ) : null}
          </div>
        </div>
      </PzSlot>
    </section>
  );
}
