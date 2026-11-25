import "server-only";
import type { PricingModel, Prisma } from "@/lib/db";

/**
 * Shared helpers for the admin "growth" area (revenue, ads, campaigns, advertisers, sellers, payouts).
 * Dates: the business runs on India time (IST, UTC+5:30, no DST). AdStatDaily.date is a DATE column
 * (Prisma returns it as UTC midnight), so its key is the ISO date; timestamps are bucketed by IST day.
 */

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** "2026-11-24" for an instant, in IST. */
export function istDayKey(d: Date): string {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
}

/** "2026-11-24" for a DATE column value (stored as UTC midnight). */
export function dateColKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** DATE-column value for a key. */
export function keyToDateCol(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** The instant IST midnight starts for a day key. */
export function keyToIstStart(key: string): Date {
  return new Date(Date.parse(`${key}T00:00:00.000Z`) - IST_MS);
}

export function addDaysKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive list of day keys from `start` to `end`. */
export function dayKeys(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) out.push(k);
  return out;
}

export function todayKey(now = new Date()): string {
  return istDayKey(now);
}

/** First day of the IST month containing `now`. */
export function monthStartKey(now = new Date()): string {
  return todayKey(now).slice(0, 8) + "01";
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Whole days between two instants (b − a), rounded down, min 0. */
export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / DAY_MS));
}

/** Inclusive number of IST calendar days a flight covers. */
export function flightDays(startsAt: Date, endsAt: Date): number {
  const a = istDayKey(startsAt);
  const b = istDayKey(endsAt);
  return Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS) + 1);
}

// ───────────────────────────── formatting (server-side labels) ─────────────────────────────

const SHORT = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const WEEKDAY = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const FULL = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const DATETIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "24 Nov" */
export const fmtShort = (d: Date | string) => SHORT.format(typeof d === "string" ? keyToDateColNoon(d) : d);
/** "Tue, 24 Nov" */
export const fmtDay = (d: Date | string) => WEEKDAY.format(typeof d === "string" ? keyToDateColNoon(d) : d);
/** "24 Nov 2026" */
export const fmtFull = (d: Date) => FULL.format(d);
/** "24 Nov, 3:40 pm" */
export const fmtDateTime = (d: Date) => DATETIME.format(d);

function keyToDateColNoon(key: string): Date {
  return new Date(`${key}T06:30:00.000Z`); // noon IST, safe for any formatter
}

/** "24–30 Nov" · "20 Oct – 2 Nov" */
export function fmtRange(a: Date, b: Date): string {
  const ka = istDayKey(a);
  const kb = istDayKey(b);
  const sa = fmtShort(ka);
  const sb = fmtShort(kb);
  if (ka.slice(0, 7) === kb.slice(0, 7)) return `${sa.split(" ")[0]}–${sb}`;
  return `${sa} – ${sb}`;
}

// ───────────────────────────── ad pricing ─────────────────────────────

export const PRICING_LABEL: Record<PricingModel, string> = {
  DAY: "per day",
  WEEK: "per week",
  MONTH: "per month",
  CPM: "per 1,000 views",
  CPC: "per click",
  CLIP: "per coupon clip",
  BOX: "per box",
};

export const PRICING_SHORT: Record<PricingModel, string> = {
  DAY: "Day",
  WEEK: "Week",
  MONTH: "Month",
  CPM: "CPM",
  CPC: "CPC",
  CLIP: "Clip",
  BOX: "Box",
};

export function rateLabel(model: PricingModel, rate: number): string {
  const r = Number.isInteger(rate) ? rate.toLocaleString("en-IN") : rate.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  switch (model) {
    case "DAY":
      return `₹${r}/day`;
    case "WEEK":
      return `₹${r}/week`;
    case "MONTH":
      return `₹${r}/month`;
    case "CPM":
      return `₹${r} CPM`;
    case "CPC":
      return `₹${r}/click`;
    case "CLIP":
      return `₹${r}/clip`;
    case "BOX":
      return `₹${r}/box`;
  }
}

/** Flat-priced (time-based) models bill by the calendar, the rest by delivery. */
export const isFlatModel = (m: PricingModel) => m === "DAY" || m === "WEEK" || m === "MONTH";

/** Cost of a flight for flat models (rate × duration); 0 for delivery-based models. */
export function flatFlightCost(model: PricingModel, rate: number, days: number): number {
  if (model === "DAY") return Math.round(rate * days);
  if (model === "WEEK") return Math.round((rate / 7) * days);
  if (model === "MONTH") return Math.round((rate / 30) * days);
  return 0;
}

// ───────────────────────────── misc ─────────────────────────────

export const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** RFC 4180 CSV (with a BOM so Excel opens ₹ and Indian names correctly). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // neutralise spreadsheet formula injection from user-entered text
    if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "cache-control": "no-store",
    },
  });
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

/** Plain-JSON copy of a value for audit / Json columns (drops undefined, Dates become ISO strings). */
export function asJson(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
}
