import type { CSSProperties } from "react";
import { cx } from "@/components/ui/cx";
import { ProductVisual, productTint, type ProductVisualData } from "@/components/ui/product-image";

/**
 * A product visual that fills its (sized) parent: the real photo when there is one, else the SVG packshot.
 * The catalogue's decorative "fans" of products (hero art, brand tiles, minis, compare table…) use this inside
 * boxes sized by CSS; `.cv` keeps photos and packshots the same size. Decorative by default (the product
 * name is always printed next to it or the parent link carries a label).
 */
export function Art({
  product,
  sizes = "160px",
  priority,
  className,
  labelled = false,
}: {
  product: ProductVisualData;
  sizes?: string;
  priority?: boolean;
  className?: string;
  labelled?: boolean;
}) {
  return (
    <span className={cx("cv", product.image?.url ? "cv-photo" : "cv-art", className)} style={{ "--tint": productTint(product) } as CSSProperties}>
      <ProductVisual product={product} sizes={sizes} priority={priority} decorative={!labelled} />
    </span>
  );
}

export const tintVar = (p: Pick<ProductVisualData, "art">) => ({ "--tint": productTint(p) }) as CSSProperties;
