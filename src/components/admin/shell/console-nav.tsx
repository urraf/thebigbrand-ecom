"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADMIN_NAV } from "@/components/admin/nav";
import { Icon, type IconName } from "@/components/ui/icon";
import { activeNavItem } from "./nav-match";

export type NavBadges = Record<string, { n: number; label: string; tone?: "new" }>;

/** Sidebar navigation from ADMIN_NAV (desktop: grouped list · ≤960px: horizontal scrolling pills). */
export function ConsoleNav({ isSuper, badges }: { isSuper: boolean; badges: NavBadges }) {
  const pathname = usePathname();
  const active = activeNavItem(pathname)?.item.href;
  const ref = useRef<HTMLElement>(null);

  // on phones keep the current tab in view inside the horizontal scroller
  useEffect(() => {
    const nav = ref.current;
    const on = nav?.querySelector<HTMLAnchorElement>("a.on");
    if (nav && on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, on.offsetLeft - 12);
  }, [active]);

  return (
    <nav className="am-nav" aria-label="Admin sections" ref={ref}>
      {ADMIN_NAV.map((g) => {
        const items = g.items.filter((i) => isSuper || !i.superadminOnly);
        if (!items.length) return null;
        return (
          <div key={g.label} style={{ display: "contents" }}>
            <span className="am-nav-h">{g.label}</span>
            {items.map((i) => {
              const on = i.href === active;
              const b = badges[i.href];
              return (
                <Link key={i.href} href={i.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
                  <Icon name={i.icon as IconName} />
                  <span>{i.label}</span>
                  {b ? (
                    <span className={b.tone === "new" ? "am-badge am-badge-new" : "am-badge"} aria-label={b.label}>
                      {b.tone === "new" ? `${b.n} new` : b.n}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
