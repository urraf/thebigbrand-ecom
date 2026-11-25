"use client";
/**
 * One tooltip for every chart mark on the page: any element with `data-tip` (title) and `data-tip-rows`
 * ("label|value|key;…", key a = ad revenue line key, s = product sales) shows the dark `.am-tip` card on
 * hover and keyboard focus. Text is set with textContent (labels can come from user data).
 */
import { useEffect, useRef } from "react";

export function ChartTips() {
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tip.current;
    if (!el) return;
    let current: Element | null = null;

    const render = (target: Element) => {
      const title = target.getAttribute("data-tip") ?? "";
      const rows = (target.getAttribute("data-tip-rows") ?? "").split(";").filter(Boolean);
      el.replaceChildren();
      if (title) {
        const t = document.createElement("div");
        t.className = "am-tip-t";
        t.textContent = title;
        el.appendChild(t);
      }
      for (const r of rows) {
        const [label, value, key] = r.split("|");
        const row = document.createElement("div");
        row.className = "am-tip-r";
        const k = document.createElement("i");
        k.className = `am-tip-k${key ? " " + key : ""}`;
        const b = document.createElement("b");
        b.textContent = value ?? "";
        const l = document.createElement("span");
        l.className = "am-tip-l";
        l.textContent = label ?? "";
        row.append(k, b, l);
        el.appendChild(row);
      }
      el.hidden = false;
    };

    const place = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x + 14;
      let top = y + 14;
      if (left + r.width > vw - 8) left = Math.max(8, x - r.width - 14);
      if (top + r.height > vh - 8) top = Math.max(8, y - r.height - 14);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };

    const find = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-tip-rows]") : null);

    const onMove = (e: PointerEvent) => {
      const target = find(e.target);
      if (!target) {
        if (current) {
          current = null;
          el.hidden = true;
        }
        return;
      }
      if (target !== current) {
        current = target;
        render(target);
      }
      place(e.clientX, e.clientY);
    };
    const onFocus = (e: FocusEvent) => {
      const target = find(e.target);
      if (!target) return;
      current = target;
      render(target);
      const r = target.getBoundingClientRect();
      place(r.left + r.width / 2, r.top + Math.min(r.height, 40));
    };
    const hide = () => {
      current = null;
      el.hidden = true;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide);
    };
  }, []);

  return <div ref={tip} className="am-tip" role="tooltip" hidden />;
}
