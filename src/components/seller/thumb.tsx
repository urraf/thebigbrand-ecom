import { ProductImage } from "@/components/ui/product-image";
import { cx } from "@/components/ui/cx";

/** Small framed product image for portal tables (photo or packshot fallback). */
export function Thumb({
  name,
  brand,
  image,
  art,
  size,
}: {
  name: string;
  brand: string;
  image: { url: string; alt: string | null } | string | null;
  art: { shape: string | null; c1: string | null; c2: string | null };
  size?: "sm" | "lg";
}) {
  const img = typeof image === "string" ? { url: image, alt: null } : image;
  return (
    <ProductImage
      className={cx("sl-thumb", size === "sm" && "sl-thumb-sm", size === "lg" && "sl-thumb-lg")}
      sizes={size === "lg" ? "64px" : "48px"}
      product={{
        name,
        image: img ? { url: img.url, alt: img.alt, width: null, height: null } : null,
        art,
        brand: { name: brand, word: null, isOwn: false },
      }}
    />
  );
}
