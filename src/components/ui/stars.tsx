import type { CSSProperties } from "react";
import { cx } from "./cx";

const STAR = "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z";

/** 5-star rating with partial fill (`.stars` in theme.css). Shared component. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span
      className={cx("stars", className)}
      style={{ "--r": `${(r / 5) * 100}%` } as CSSProperties}
      role="img"
      aria-label={`${r.toFixed(1)} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );
}
