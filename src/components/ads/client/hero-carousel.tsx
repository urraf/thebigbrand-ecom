"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { useReducedMotion } from "./hooks";

export type HeroSlide = {
  key: string;
  /** campaign id (impression tracking) */
  trackId: string;
  /** short tab label ("L'Oréal Paris", "Free gifts") */
  tab: string;
  /** accessible slide name */
  label: string;
  /** foreground colour (nav controls follow the active slide) */
  fg: string;
  className?: string;
  style?: CSSProperties;
  content: ReactNode;
};

const DUR = 6000;

/**
 * H1 hero billboard carousel (port of the demo's mountHero): autoplay with per-slide progress tabs, pause on
 * hover / keyboard focus / when scrolled out of view, arrows, keyboard ←/→, swipe, play/pause button and
 * prefers-reduced-motion (starts paused). Slides are server-rendered; this island only switches them.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const n = slides.length;
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [entered, setEntered] = useState(false);
  const reduce = useReducedMotion();
  const [choice, setChoice] = useState<boolean | null>(null);
  const stopped = choice ?? reduce;
  const car = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLElement | null)[]>([]);
  const st = useRef({ elapsed: 0, last: 0, hover: false, focus: false, inView: true, stopped: false, i: 0, sx: 0, sy: 0 });

  const fill = (k: number, v: number) => {
    const b = bars.current[k];
    if (b) b.style.transform = `scaleX(${v})`;
  };

  const show = useCallback(
    (k: number) => {
      if (n < 2) return;
      const s = st.current;
      const next = ((k % n) + n) % n;
      if (next === s.i) return;
      fill(s.i, 0);
      setPrev(s.i);
      s.i = next;
      s.elapsed = 0;
      setI(next);
      fill(next, s.stopped ? 1 : 0);
    },
    [n],
  );

  // clear the cross-fade "previous" layer after the transition
  useEffect(() => {
    if (prev < 0) return;
    const t = setTimeout(() => setPrev(-1), 950);
    return () => clearTimeout(t);
  }, [prev, i]);

  useEffect(() => {
    const s = st.current;
    fill(0, s.stopped ? 1 : 0);
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = s.last ? Math.min(100, t - s.last) : 0;
      s.last = t;
      if (s.stopped || s.hover || s.focus || !s.inView || n < 2 || document.hidden) return;
      s.elapsed += dt;
      if (s.elapsed >= DUR) show(s.i + 1);
      else fill(s.i, s.elapsed / DUR);
    };
    raf = requestAnimationFrame(frame);
    let io: IntersectionObserver | null = null;
    if (car.current && "IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => (s.inView = es[es.length - 1].isIntersecting), { threshold: 0.2 });
      io.observe(car.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(r1);
      io?.disconnect();
    };
  }, [n, show]);

  // keep the animation loop's copy of "stopped" in sync (reduced motion starts paused)
  useEffect(() => {
    const s = st.current;
    s.stopped = stopped;
    fill(s.i, stopped ? 1 : s.elapsed / DUR);
  }, [stopped]);

  const toggle = () => setChoice(!stopped);

  return (
    <div
      className={cx("zn-car", stopped && "is-stopped")}
      ref={car}
      style={{ "--zn-nav": slides[i]?.fg ?? "#fff" } as CSSProperties}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") st.current.hover = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") st.current.hover = false;
      }}
      onFocus={(e) => {
        try {
          if ((e.target as HTMLElement).matches(":focus-visible")) st.current.focus = true;
        } catch {
          st.current.focus = true;
        }
      }}
      onBlur={(e) => {
        if (!car.current?.contains(e.relatedTarget as Node)) st.current.focus = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          show(st.current.i - 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          show(st.current.i + 1);
        }
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        st.current.sx = t.clientX;
        st.current.sy = t.clientY;
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - st.current.sx;
        const dy = t.clientY - st.current.sy;
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) show(st.current.i + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="zn-slides" aria-live={stopped ? "polite" : "off"}>
        {slides.map((sl, k) => {
          const on = k === i;
          return (
            <div
              key={sl.key}
              className={cx("zn-slide", sl.className, on && "is-on", on && entered && "is-in", k === prev && !on && "is-prev")}
              role="group"
              aria-roledescription="slide"
              aria-label={`${k + 1} of ${n}: ${sl.label}`}
              aria-hidden={on ? undefined : true}
              inert={!on}
              style={sl.style}
              data-pz-imp={sl.trackId}
            >
              {sl.content}
            </div>
          );
        })}
      </div>
      <div className="zn-fade" aria-hidden="true" />
      {n > 1 ? (
        <div className="wrap zn-nav">
          <button type="button" className="zn-arrow" onClick={() => show(st.current.i - 1)} aria-label="Previous offer">
            <Icon name="chevLeft" />
          </button>
          <button type="button" className="zn-arrow" onClick={() => show(st.current.i + 1)} aria-label="Next offer">
            <Icon name="chevRight" />
          </button>
          <div className="zn-tabs">
            {slides.map((sl, k) => (
              <button
                key={sl.key}
                type="button"
                className={cx("zn-tab", k === i && "is-on")}
                onClick={() => show(k)}
                aria-label={`Offer ${k + 1} of ${n}: ${sl.tab}`}
                aria-current={k === i ? "true" : "false"}
              >
                <span>{sl.tab}</span>
                <i className="zn-tab-bar">
                  <b ref={(el) => void (bars.current[k] = el)} />
                </i>
              </button>
            ))}
          </div>
          <button type="button" className="zn-play" onClick={toggle} aria-label={stopped ? "Play slideshow" : "Pause slideshow"}>
            <Icon name={stopped ? "play" : "pause"} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
