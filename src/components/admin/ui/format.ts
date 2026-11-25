/** Client-safe formatting helpers for the admin console (dates in IST, initials, avatar tints, URLs). */
import { compactINR, formatINR } from "@/lib/money";

export { formatINR, compactINR };

const TZ = "Asia/Kolkata";

type DateLike = Date | string | number | null | undefined;
const toDate = (d: DateLike) => (d == null ? null : d instanceof Date ? d : new Date(d));

/** "Tue, 24 Nov" */
export function fmtDay(d: DateLike): string {
  const x = toDate(d);
  return x ? x.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }) : "—";
}

/** "24 Nov 2026" */
export function fmtDate(d: DateLike): string {
  const x = toDate(d);
  return x ? x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "—";
}

/** "24 Nov, 4:05 pm" */
export function fmtDateTime(d: DateLike): string {
  const x = toDate(d);
  if (!x) return "—";
  return x.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
}

/** "4:05 pm" */
export function fmtTime(d: DateLike): string {
  const x = toDate(d);
  return x ? x.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }) : "—";
}

/** yyyy-mm-dd in IST (for <input type="date"> values) */
export function isoDay(d: DateLike): string {
  const x = toDate(d);
  if (!x) return "";
  return new Date(x.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** "2h ago", "3d ago" — relative to `now` (pass the server's now to avoid hydration drift). */
export function fmtAgo(d: DateLike, now: DateLike = Date.now()): string {
  const x = toDate(d);
  const n = toDate(now);
  if (!x || !n) return "—";
  const s = Math.max(0, Math.round((n.getTime() - x.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return fmtDate(x);
}

export function initials(name: string | null | undefined): string {
  return (
    String(name || "?")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

const AV = ["#ffe3ea", "#e9e4fb", "#e3f2ff", "#e3f6ee", "#fff1d6", "#f3e5f5"];
export function avatarTint(seed: string | null | undefined): string {
  let h = 7;
  for (const c of String(seed || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV[h % AV.length];
}

export function pct(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}

export type SearchParamsInput = Record<string, string | string[] | undefined>;

/** Flatten Next.js searchParams to single string values (first wins). */
export function flatParams(sp: SearchParamsInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val != null && val !== "") out[k] = val;
  }
  return out;
}

/** Build `base?…` from current params + a patch (null/"" removes a key). Resets `page` unless patched. */
export function hrefWith(base: string, params: Record<string, string>, patch: Record<string, string | number | null | undefined>, keepPage = false): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (keepPage || k !== "page") next.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, String(v));
  }
  const qs = next.toString();
  return qs ? `${base}?${qs}` : base;
}
