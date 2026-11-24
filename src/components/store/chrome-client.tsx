"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { COOKIES } from "@/lib/site";
import { toast } from "@/components/ui/toast";
import { LocationDialog, openLocationDialog } from "./location";

/**
 * The store chrome's only always-on script (tiny): delegated handlers for the server-rendered chrome
 * buttons marked `data-chrome="…"` (menu open/close, back-to-top, language, deliver-to, ad-slot inspector),
 * Esc handling, focus management for the drawer, and per-navigation effects (active nav link, closing
 * the drawer, notifying the search box).
 */

let lastOpener: HTMLElement | null = null;

function menuEl() {
  return document.getElementById("menu");
}

/** While the drawer is open the page behind it is inert (modal: Tab can't wander under the scrim). */
const BACKGROUND = ["hdr", "main", "ftr", "tabbar"];
function setBackgroundInert(on: boolean) {
  for (const id of BACKGROUND) {
    const el = document.getElementById(id);
    if (el) el.inert = on;
  }
}

export function openMenu(opener?: HTMLElement | null) {
  const menu = menuEl();
  if (!menu) return;
  lastOpener = opener ?? (document.activeElement as HTMLElement | null);
  menu.inert = false;
  menu.setAttribute("aria-hidden", "false");
  setBackgroundInert(true);
  document.body.classList.add("menu-open");
  document.querySelectorAll('[data-chrome="menu-open"]').forEach((b) => b.setAttribute("aria-expanded", "true"));
  requestAnimationFrame(() => menu.querySelector<HTMLElement>(".mn-head .ib-sm")?.focus());
}

export function closeMenu() {
  const menu = menuEl();
  if (!document.body.classList.contains("menu-open")) return;
  document.body.classList.remove("menu-open");
  setBackgroundInert(false);
  document.querySelectorAll('[data-chrome="menu-open"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
  if (menu) {
    menu.inert = true;
    menu.setAttribute("aria-hidden", "true");
  }
  if (lastOpener && document.contains(lastOpener)) lastOpener.focus({ preventScroll: true });
  lastOpener = null;
}

function readInspect(): boolean {
  return document.cookie.split("; ").some((c) => c === `${COOKIES.inspector}=1`);
}

/** Toggles the "Show ad slots" overlay (body.inspect + cookie) and tells the ads inspector. */
export function toggleInspector() {
  const on = !document.body.classList.contains("inspect");
  document.body.classList.toggle("inspect", on);
  document.cookie = `${COOKIES.inspector}=${on ? 1 : 0}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  window.dispatchEvent(new CustomEvent("tbb:inspect", { detail: { on } }));
  toast(on ? "Showing every ad slot with its rate — this is how the client earns" : "Ad slot overlay hidden", { icon: "megaphone" });
}

function matchesNav(nav: string, pathname: string, search: URLSearchParams): boolean {
  const [path, qs] = nav.split("?");
  if (path !== pathname) return false;
  if (!qs) return path !== "/s" || ![...search.keys()].some((k) => k === "sort" || k === "concern");
  const want = new URLSearchParams(qs);
  return [...want.entries()].every(([k, v]) => search.get(k) === v);
}

function RouteEffects() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  useEffect(() => {
    closeMenu();
    const sp = new URLSearchParams(search);
    document.querySelectorAll<HTMLElement>("[data-nav]").forEach((a) => {
      const on = matchesNav(a.dataset.nav ?? "", pathname, sp);
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    window.dispatchEvent(new CustomEvent("tbb:route", { detail: { pathname, search } }));
  }, [pathname, search]);
  return null;
}

export function ChromeClient() {
  useEffect(() => {
    const menu = menuEl();
    if (menu) menu.inert = !document.body.classList.contains("menu-open");
    if (readInspect()) document.body.classList.add("inspect");

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      const el = target.closest<HTMLElement>("[data-chrome]");
      if (el) {
        switch (el.dataset.chrome) {
          case "menu-open":
            e.preventDefault();
            openMenu(el);
            return;
          case "menu-close":
            e.preventDefault();
            closeMenu();
            return;
          case "to-top":
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          case "lang":
            toast("हिन्दी and regional languages are coming soon", { icon: "globe" });
            return;
          case "loc":
            e.preventDefault();
            openLocationDialog();
            return;
          case "inspect":
            e.preventDefault();
            closeMenu();
            toggleInspector();
            return;
        }
      }
      // following a link inside the drawer closes it (also covers links to the current page)
      if (target.closest("#menu a[href]")) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <RouteEffects />
      </Suspense>
      <LocationDialog />
    </>
  );
}
