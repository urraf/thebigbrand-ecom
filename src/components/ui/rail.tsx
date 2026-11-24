"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icon";

type RailProps = {
  children: ReactNode;
  className?: string;
  /** accessible name for the scroller region */
  label?: string;
  /** width of each item (any CSS length). Default 220px desktop / 172px phone */
  itemWidth?: string;
};

/**
 * Horizontal scroller with arrow buttons (demo ui.rail). Children stay Server Components; only the arrow
 * logic ships to the browser. Arrows hide at either end and on touch devices.
 */
export function Rail({ children, className, label, itemWidth }: RailProps) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const start = t.scrollLeft <= 4;
    const end = t.scrollLeft + t.clientWidth >= t.scrollWidth - 4;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    measure();
    t.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    return () => {
      t.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  const scroll = (dir: number) => {
    const t = track.current;
    if (t) t.scrollBy({ left: dir * t.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div
      className={cx("rail", className)}
      role="region"
      aria-label={label}
      style={itemWidth ? ({ "--rail-item": itemWidth } as CSSProperties) : undefined}
    >
      <button type="button" className="rail-btn prev" aria-label="Scroll left" onClick={() => scroll(-1)} disabled={edge.start} tabIndex={-1}>
        <Icon name="chevLeft" />
      </button>
      <div className="rail-track" ref={track}>
        {children}
      </div>
      <button type="button" className="rail-btn next" aria-label="Scroll right" onClick={() => scroll(1)} disabled={edge.end} tabIndex={-1}>
        <Icon name="chevRight" />
      </button>
    </div>
  );
}
