/**
 * Shared building blocks for ad creatives (Server Components, zero JS): labels, product visuals inside
 * creatives, campaign photos, section headers. Class prefix `zn-` (ad-blocker safe).
 */
import Image, { getImageProps } from "next/image";
import type { CSSProperties, ReactNode } from "react";
import type { ProductCardData, ServedAd } from "@/types/shared";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { Packshot } from "@/components/ui/packshot";
import { ProductVisual } from "@/components/ui/product-image";
import { PzBadge } from "@/components/ui/pz-slot";

const OPTIMIZABLE = /^(\/(?!\/)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/)/i;
export const optimizable = (url: string) => OPTIMIZABLE.test(url);

/** Attributes that register a creative with the impression tracker (≥50% visible for 1 s). */
export function trackProps(ad: Pick<ServedAd, "id"> | null | undefined): Record<string, string> {
  return ad ? { "data-pz-imp": ad.id } : {};
}

/** "The Big Brands" label for house placements. */
export function HouseTag({ text = "The Big Brands" }: { text?: string }) {
  return (
    <span className="zn-htag">
      <i aria-hidden="true">tbb</i>
      {text}
    </span>
  );
}

/** Pill label on themed creatives: "Ad · Sponsored by Brand" (house → "The Big Brands"). */
export function ZnTag({ ad, compact = false }: { ad: Pick<ServedAd, "isHouse" | "brand">; compact?: boolean }) {
  if (ad.isHouse) return <HouseTag />;
  return (
    <span className="zn-ptag">
      <PzBadge />
      <span>
        Sponsored
        {!compact && ad.brand ? (
          <span className="zn-ptag-by">
            {" "}
            by <b>{ad.brand.name}</b>
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Small grey "Sponsored ⓘ" label (section headers, cards). House → "The Big Brands". */
export function SpLabel({ text = "Sponsored", house = false }: { text?: string; house?: boolean }) {
  if (house) return <HouseTag />;
  return (
    <span className="sp-label">
      {text}
      <Icon name="info" />
    </span>
  );
}

/**
 * A product inside a creative: the SVG packshot when there is no photo, or the photo on a clean white card
 * (studio photos have white backgrounds, which would look broken floating on a coloured creative).
 */
export function ZnVisual({ product, sizes = "240px", eager = false, blend = false, className }: { product: ProductCardData; sizes?: string; eager?: boolean; blend?: boolean; className?: string }) {
  if (product.image?.url) {
    // `blend`: on light backgrounds the photo is multiplied straight onto the creative (no white card)
    return (
      <span className={cx("zn-ph", blend && "is-blend", className)}>
        <ProductVisual product={product} sizes={sizes} priority={eager} />
      </span>
    );
  }
  return <Packshot art={product.art} name={product.name} brand={product.brand} isOwnLabel={product.isOwnLabel} className={className} />;
}

/** Campaign photo (lifestyle image) filling its positioned parent; desktop + optional mobile art direction. */
export function ZnPhoto({ src, mobileSrc, alt, sizes = "100vw", eager = false, className, style }: { src: string; mobileSrc?: string | null; alt: string; sizes?: string; eager?: boolean; className?: string; style?: CSSProperties }) {
  if (mobileSrc && mobileSrc !== src) {
    const common = { alt, fill: true as const, sizes, unoptimized: !optimizable(src) };
    const { props: { srcSet: desktop } } = getImageProps({ ...common, src });
    const { props: { srcSet: mobile, ...rest } } = getImageProps({ ...common, src: mobileSrc, unoptimized: !optimizable(mobileSrc) });
    return (
      <picture className={className} style={style}>
        <source media="(min-width: 761px)" srcSet={desktop ?? src} />
        <source media="(max-width: 760px)" srcSet={mobile ?? mobileSrc} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- `alt` comes from getImageProps (art-directed <picture>) */}
        <img {...rest} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
      </picture>
    );
  }
  return (
    <span className={className} style={style}>
      <Image src={src} alt={alt} fill sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} unoptimized={!optimizable(src)} />
    </span>
  );
}

/** Section header used by multi-tile zones (demo .hm-h). */
export function ZnHead({ id, title, kick, kickIcon, sub, right }: { id: string; title: string; kick?: string; kickIcon?: IconName; sub?: string; right?: ReactNode }) {
  return (
    <div className="zn-h">
      <div className="zn-h-l">
        {kick ? (
          <span className="zn-h-k">
            {kickIcon ? <Icon name={kickIcon} /> : null}
            {kick}
          </span>
        ) : null}
        <h2 id={id}>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
      {right ? <div className="zn-h-r">{right}</div> : null}
    </div>
  );
}

/** Headline with the closing phrase underlined by the hand-drawn swash. */
export function SwashHeadline({ parts }: { parts: [string, string] }) {
  return (
    <>
      {parts[0]}
      {parts[1] ? (
        <>
          {" "}
          <span className="zn-hl">{parts[1]}</span>
        </>
      ) : null}
    </>
  );
}

/** Product pill price ("₹349") */
export const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function discountOf(p: Pick<ProductCardData, "mrp" | "price">): number {
  return p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
}
