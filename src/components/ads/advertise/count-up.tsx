"use client";
import { useEffect, useRef } from "react";

/** Animated number (counts up once when it scrolls into view; static for reduced motion / no JS). */
export function CountUp({ to, dec = 0, pre = "", suf = "" }: { to: number; dec?: number; pre?: string; suf?: string }) {
  const ref = useRef<HTMLElement>(null);
  const format = (v: number) => pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-IN")) + suf;
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 1300);
        const ease = 1 - Math.pow(1 - k, 3);
        el.textContent = format(to * ease);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate once per value
  }, [to]);
  return <b ref={ref}>{format(to)}</b>;
}
