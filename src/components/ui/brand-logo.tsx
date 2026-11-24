import type { CSSProperties } from "react";
import type { BrandLite } from "@/types/shared";
import { cx } from "./cx";
import "@/styles/store/ui.css";

type BrandLogoProps = {
  brand: Pick<BrandLite, "name" | "word" | "sub" | "color" | "font" | "fontWeight" | "textTransform" | "letterSpacing" | "italic" | "logoUrl">;
  /** font size of the wordmark in px (logo images are sized to ~1.6× this height) */
  size?: number;
  /** override the brand colour (e.g. white on dark creatives) */
  color?: string;
  className?: string;
  /** show the small sub-line (e.g. "PARIS" under L'ORÉAL). Default true */
  showSub?: boolean;
};

/**
 * Brand wordmark — styled text from the Brand row (font, weight, case, tracking, colour), or the uploaded
 * logo image when `logoUrl` is set. Port of the demo's ui.brandLogo(). Shared component.
 */
export function BrandLogo({ brand, size = 18, color, className, showSub = true }: BrandLogoProps) {
  if (brand.logoUrl) {
    return (
      <span className={cx("blogo blogo-img", className)} style={{ height: Math.round(size * 1.6) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- brand logos have unknown intrinsic sizes */}
        <img src={brand.logoUrl} alt={brand.name} loading="lazy" decoding="async" />
      </span>
    );
  }
  const style: CSSProperties = {
    fontFamily: brand.font ?? "inherit",
    fontWeight: brand.fontWeight || 700,
    textTransform: (brand.textTransform || "none") as CSSProperties["textTransform"],
    letterSpacing: brand.letterSpacing || 0,
    fontSize: size,
    color: color ?? brand.color,
    fontStyle: brand.italic ? "italic" : undefined,
  };
  return (
    <span className={cx("blogo", className)} style={style} role="img" aria-label={brand.name}>
      <span aria-hidden="true">{brand.word || brand.name}</span>
      {showSub && brand.sub ? (
        <small aria-hidden="true">{brand.sub}</small>
      ) : null}
    </span>
  );
}
