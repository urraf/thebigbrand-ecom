"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AV_EVENT, scrollToId, type AvAct } from "./shared";

const NAV: [string, string][] = [
  ["av-top", "Overview"],
  ["av-why", "Why us"],
  ["av-formats", "Ad formats"],
  ["av-ratecard", "Rate card"],
  ["av-est", "Estimator"],
  ["av-book", "Book a campaign"],
  ["av-stories", "Results"],
  ["av-faq", "FAQ"],
];

/** Sticky section nav with the active section highlighted (IntersectionObserver) and smooth jumps. */
export function AvNav() {
  const [active, setActive] = useState("av-top");
  const links = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (ents) => ents.forEach((en) => en.isIntersecting && setActive(en.target.id)),
      { rootMargin: "-35% 0px -60% 0px" },
    );
    NAV.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    const onAct = (e: Event) => {
      const a = (e as CustomEvent<AvAct>).detail;
      if (a?.type === "jump") {
        setActive(a.target);
        scrollToId(a.target);
      }
    };
    window.addEventListener(AV_EVENT, onAct);
    return () => {
      io.disconnect();
      window.removeEventListener(AV_EVENT, onAct);
    };
  }, []);

  // keep the active pill visible inside the scrolling strip (phones)
  useEffect(() => {
    const p = links.current;
    const on = p?.querySelector<HTMLElement>("button.on");
    if (!p || !on || p.scrollWidth <= p.clientWidth) return;
    const pr = p.getBoundingClientRect();
    const r = on.getBoundingClientRect();
    p.scrollTo({ left: Math.max(0, p.scrollLeft + (r.left - pr.left) - (pr.width - r.width) / 2), behavior: "smooth" });
  }, [active]);

  const jump = (id: string) => {
    setActive(id);
    scrollToId(id);
  };

  return (
    <nav className="av-nav" aria-label="Advertise with us — sections">
      <div className="wrap av-nav-in">
        <span className="av-nav-brand">
          <i>
            <Icon name="megaphone" />
          </i>
          TBB&nbsp;Ads
        </span>
        <div className="av-nav-links" ref={links}>
          {NAV.map(([id, l]) => (
            <button key={id} type="button" className={active === id ? "on" : undefined} aria-current={active === id ? "true" : undefined} onClick={() => jump(id)}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-cart btn-sm av-nav-cta" onClick={() => jump("av-book")}>
          Book a campaign
        </button>
      </div>
    </nav>
  );
}
