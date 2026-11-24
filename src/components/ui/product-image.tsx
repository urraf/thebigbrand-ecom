import Image from "next/image";
import type { CSSProperties } from "react";
import type { BrandLite, ImageLite, PackshotArt } from "@/types/shared";
import { cx, safeColor } from "./cx";
import { Packshot } from "./packshot";
import "@/styles/store/ui.css";

/** Anything with enough data to draw a product (ProductCardData satisfies it). */
export type ProductVisualData = {
  name: string;
  image: ImageLite | null;
  art: PackshotArt;
  isOwnLabel?: boolean;
  brand: Pick<BrandLite, "name" | "word" | "isOwn">;
};

type VisualProps = {
  product: ProductVisualData;
  /** next/image `sizes` (the rendered width of the frame) */
  sizes?: string;
  /** above-the-fold images: load eagerly with high fetch priority instead of lazy-loading */
  priority?: boolean;
  className?: string;
  /** the product name is printed right next to the image (search rows, flyout): hide the image from screen readers */
  decorative?: boolean;
};

const OPTIMIZABLE = /^(\/(?!\/)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/)/i;

/** Tint colour for the frame behind a product (packshot body colour). */
export function productTint(product: Pick<ProductVisualData, "art">): string {
  return safeColor(product.art.c1, "#e7e4ee");
}

/**
 * The bare product visual: a real photo (next/image, `fill`) when the product has one, else the SVG
 * packshot. Place it inside a positioned, sized frame (e.g. `.pc-img`). Shared component.
 */
export function ProductVisual({ product, sizes = "240px", priority, className, decorative }: VisualProps) {
  if (product.image?.url) {
    const url = product.image.url;
    return (
      <span className={cx("pv-photo", className)}>
        <Image
          src={url}
          alt={decorative ? "" : product.image.alt || `${product.brand.name} ${product.name}`}
          fill
          sizes={sizes}
          // Next 16: `priority` is deprecated — eager + high fetch priority for above-the-fold (LCP) images
          loading={priority ? "eager" : undefined}
          fetchPriority={priority ? "high" : undefined}
          // never crash a page on an unexpected host: serve such URLs as-is
          unoptimized={!OPTIMIZABLE.test(url)}
        />
      </span>
    );
  }
  return (
    <Packshot art={product.art} name={product.name} brand={product.brand} isOwnLabel={product.isOwnLabel} className={className} labelled={!decorative} />
  );
}

/**
 * Framed product image: the consistent tinted frame used across the store (cards, cart lines, suggestions,
 * the added-to-cart flyout). Photos are multiplied onto the tint so white studio backgrounds blend in.
 */
export function ProductImage({ product, sizes, priority, className, decorative }: VisualProps) {
  return (
    <span className={cx("pimg", product.image?.url ? "is-photo" : "is-art", className)} style={{ "--tint": productTint(product) } as CSSProperties}>
      <ProductVisual product={product} sizes={sizes} priority={priority} decorative={decorative} />
    </span>
  );
}
