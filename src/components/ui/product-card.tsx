import Link from "next/link";
import type { CSSProperties } from "react";
import type { ProductCardData } from "@/types/shared";
import { compactNumber } from "@/lib/money";
import { site } from "@/lib/site";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { WishButton } from "@/components/cart/wish-button";
import { cx } from "./cx";
import { DeliveryDate } from "./delivery-date";
import { Icon } from "./icon";
import { Price } from "./price";
import { ProductVisual, productTint } from "./product-image";
import { PzSlot, type SlotInfo } from "./pz-slot";
import { Stars } from "./stars";
import "@/styles/store/ui.css";

export type ProductCardProps = {
  product: ProductCardData;
  /** paid placement: shows the "Sponsored ⓘ" label */
  sponsored?: boolean;
  /** compact rail variant: no bought/delivery/gift lines */
  compact?: boolean;
  /** wrap in a pz-slot inspector wrapper (ad placements) */
  slot?: SlotInfo | null;
  /** override the product link (e.g. a tracked ad click URL) */
  href?: string;
  /** above-the-fold: preload the photo */
  priority?: boolean;
  /** next/image sizes for the photo */
  sizes?: string;
  className?: string;
  /** "+ free TBB gift with order" line (default true) */
  showGift?: boolean;
};

/** "1.5K+ bought in past month" from Product.soldCount (hidden below 50). */
export function boughtLabel(soldCount: number): string | null {
  if (!soldCount || soldCount < 50) return null;
  const n = soldCount >= 100 ? Math.floor(soldCount / 100) * 100 : 50;
  return `${compactNumber(n)}+ bought in past month`;
}

/**
 * Product card — the demo's `.pc` design: image (photo or packshot), wishlist heart, optional Sponsored label,
 * brand link, 2-line name, rating + count, "bought in past month", price block, delivery date, free-gift line
 * and Add to cart. A Server Component with three tiny client islands (heart, delivery date, add button); also
 * importable from Client Components.
 */
export function ProductCard({ product: p, sponsored, compact, slot, href, priority, sizes, className, showGift = true }: ProductCardProps) {
  const link = href ?? `/p/${p.slug}`;
  const external = link.startsWith("/api/"); // tracked ad clicks are plain redirects, not app routes
  const badge = p.badge ?? (p.isOwnLabel ? "TBB Original" : null);
  const soldOut = p.stock <= 0;
  const bought = compact ? null : boughtLabel(p.soldCount);
  const title = p.size ? `${p.name}, ${p.size}` : p.name;
  const imgSizes = sizes ?? (compact ? "(max-width: 600px) 45vw, 200px" : "(max-width: 600px) 46vw, (max-width: 1100px) 30vw, 290px");

  const card = (
    <article className={cx("pc", sponsored && "is-sp", compact && "pc-compact", soldOut && "is-soldout", className)}>
      {external ? (
        <a className="pc-img" href={link} style={{ "--tint": productTint(p) } as CSSProperties} tabIndex={-1} aria-hidden="true" rel="sponsored">
          <ProductVisual product={p} sizes={imgSizes} priority={priority} />
          {badge ? <span className="pc-badge">{badge}</span> : null}
        </a>
      ) : (
        <Link className="pc-img" href={link} style={{ "--tint": productTint(p) } as CSSProperties} tabIndex={-1} aria-hidden="true" prefetch={false}>
          <ProductVisual product={p} sizes={imgSizes} priority={priority} />
          {badge ? <span className="pc-badge">{badge}</span> : null}
        </Link>
      )}
      <WishButton productId={p.id} productName={p.name} />
      <div className="pc-body">
        {sponsored ? (
          <span className="sp-label">
            Sponsored
            <Icon name="info" />
          </span>
        ) : null}
        <Link className="pc-brand" href={`/brand/${p.brand.slug}`} prefetch={false}>
          {p.brand.isOwn ? p.brand.word || p.brand.name : p.brand.name}
        </Link>
        {external ? (
          <a className="pc-name" href={link} rel="sponsored" title={title}>
            {title}
          </a>
        ) : (
          <Link className="pc-name" href={link} title={title}>
            {title}
          </Link>
        )}
        {p.reviewCount > 0 ? (
          <div className="pc-rate">
            <Stars rating={p.rating} />
            <span>{p.rating.toFixed(1)}</span>
            <span className="cnt">({p.reviewCount.toLocaleString("en-IN")})</span>
          </div>
        ) : (
          <div className="pc-rate pc-new">New arrival</div>
        )}
        {bought ? <div className="pc-bought">{bought}</div> : null}
        <Price price={p.price} mrp={p.mrp} />
        {!compact && !soldOut ? (
          <div className="pc-del">
            {p.price >= site.freeShippingMin ? "FREE delivery " : "Get it by "}
            <DeliveryDate days={2} />
          </div>
        ) : null}
        {!compact && showGift && !soldOut ? (
          <div className="pc-gift">
            <Icon name="gift" /> + free TBB gift with order
          </div>
        ) : null}
        {!soldOut && p.stock <= 5 ? <div className="pc-stock">Only {p.stock} left in stock</div> : null}
        <AddToCartButton productId={p.id} outOfStock={soldOut} productName={p.name} />
      </div>
    </article>
  );

  return slot ? (
    <PzSlot slot={slot} className="slot-card">
      {card}
    </PzSlot>
  ) : (
    card
  );
}
