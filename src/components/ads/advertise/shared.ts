/** Shared client-safe helpers for the Advertise page. */
import type { IconName } from "@/components/ui/icon";

export const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
/** 14000 → "14K", 840000 → "8.4L" (demo kfmt) */
export const nf = (n: number) => {
  const v = Math.round(n);
  if (v >= 10000000) return (v / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr";
  if (v >= 100000) return (v / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(v);
};
export const pct = (n: number) => (n * 100).toFixed(n < 0.1 ? 1 : 0) + "%";

export const GROUPS: { id: string; name: string; ic: IconName; desc: string }[] = [
  { id: "home", name: "Homepage", ic: "home", desc: "The most-viewed page — billboards, video, reels and coupons" },
  { id: "search", name: "Search", ic: "search", desc: "Show up the moment shoppers type what they want" },
  { id: "product", name: "Product page", ic: "tag", desc: "Win the comparison on related product pages" },
  { id: "checkout", name: "Cart & checkout", ic: "cart", desc: "The highest-intent moments of the visit" },
  { id: "brand", name: "Brand store", ic: "store", desc: "Your storefront inside the marketplace" },
  { id: "offline", name: "Offline · in-box", ic: "box", desc: "A flyer or sample in every delivery box" },
];
export const grpOf = (page: string) => (page === "cart" || page === "success" ? "checkout" : page);
export const pageName = (page: string) => GROUPS.find((g) => g.id === grpOf(page))?.name ?? page;
export const HOT: Record<string, string> = { H1: "Most booked", H2: "Best value", C1: "Highest intent", S2: "Top CTR", X1: "Only on TBB" };
export const PV_NOTE: Record<string, string> = {
  H1: "one of up to 5 rotations at the top of the homepage",
  H2: "one of 4 cards overlapping the hero billboard",
  H3: "full-width strip between homepage sections",
  H5: "autoplay, muted, with sound on tap",
  H8: "one of two half-width banners on the homepage",
  H10: "the countdown deal block on the homepage",
  S2: "above search results for your brand & category keywords",
  C2: "on the order confirmation page",
};

export const ADS_EMAIL = "ads@thebigbrands.co.in";
export const salesMail = (subject: string) => `mailto:${ADS_EMAIL}?subject=${encodeURIComponent(subject)}`;

// ── a tiny event bus so server-rendered buttons (rate card, formats) can drive the estimator / booking form ──
export type AvAct = { type: "pick"; slot: string; days?: number } | { type: "estimate"; slot: string } | { type: "jump"; target: string };
export const AV_EVENT = "av:act";
export function avEmit(act: AvAct) {
  window.dispatchEvent(new CustomEvent<AvAct>(AV_EVENT, { detail: act }));
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function flash(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("av-flash");
  void el.offsetWidth;
  el.classList.add("av-flash");
}

// ── dates (IST calendar days as YYYY-MM-DD) ──
const IST = 330 * 60 * 1000;
export const todayIso = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
export function addDays(iso: string, n: number) {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export const dLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const validIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
