/**
 * Ad pricing maths — shared by the server (booking, billing) and the browser (estimator, booking summary).
 * Client-safe: no server imports. All money is rupees (spend/rates may be fractional, quotes are whole ₹).
 *
 * Billing per day (ARCHITECTURE "Ad billing"):
 *   DAY: rate · WEEK: rate/7 · MONTH: rate/30 · CPM: impressions/1000 × rate · CPC: clicks × rate
 *   CLIP: clips × rate · BOX: boxes × rate · house ads cost 0.
 */

export type PricingModelCode = "DAY" | "WEEK" | "MONTH" | "CPM" | "CPC" | "CLIP" | "BOX";

export const GST_RATE = 0.18;
export const MAX_CAMPAIGN_DAYS = 90;
/** minimum budget for performance (CPM/CPC) campaigns */
export const MIN_PERF_BUDGET = 5000;
export const MAX_PERF_BUDGET = 5_000_000;
/** days of notice we need to review a creative before it can start */
export const MIN_LEAD_DAYS = 1;

export const UNIT_DAYS: Partial<Record<PricingModelCode, number>> = { DAY: 1, WEEK: 7, MONTH: 30 };

export function isTimeBased(model: string): boolean {
  return model === "DAY" || model === "WEEK" || model === "MONTH";
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const inrExact = (n: number) => "₹" + (Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: 2 }));

/** "₹4,000/day", "₹220 CPM", "₹5 CPC", "₹1.5/clip", "₹4/box" (demo rateText) */
export function rateLabel(model: string, rate: number): string {
  switch (model) {
    case "DAY":
      return `${inr(rate)}/day`;
    case "WEEK":
      return `${inr(rate)}/week`;
    case "MONTH":
      return `${inr(rate)}/month`;
    case "CPM":
      return `${inrExact(rate)} CPM`;
    case "CPC":
      return `${inrExact(rate)} CPC`;
    case "CLIP":
      return `${inrExact(rate)}/clip`;
    case "BOX":
      return `${inrExact(rate)}/box`;
    default:
      return inrExact(rate);
  }
}

export const MODEL_SHORT: Record<string, string> = {
  DAY: "Per day",
  WEEK: "Per week",
  MONTH: "Per month",
  CPM: "CPM",
  CPC: "CPC",
  CLIP: "Per clip",
  BOX: "Per box",
};
export const MODEL_LONG: Record<string, string> = {
  DAY: "Fixed · per day",
  WEEK: "Fixed · per week",
  MONTH: "Fixed · per month",
  CPM: "CPM · per 1,000 views",
  CPC: "CPC · per click",
  CLIP: "Per coupon clip",
  BOX: "Per delivery box",
};

/** ₹ billed for one day of delivery. */
export function dailySpend(model: string, rate: number, day: { impressions: number; clicks: number }): number {
  let v: number;
  switch (model) {
    case "DAY":
      v = rate;
      break;
    case "WEEK":
      v = rate / 7;
      break;
    case "MONTH":
      v = rate / 30;
      break;
    case "CPM":
      v = (day.impressions / 1000) * rate;
      break;
    case "CPC":
    case "CLIP":
      v = day.clicks * rate;
      break;
    case "BOX":
      v = 0; // offline inserts are invoiced by the fulfilment team
      break;
    default:
      v = 0;
  }
  return Math.round(v * 100) / 100;
}

/** Volume discount on per-day placements: 10% off 14+ days, 15% off 30+ days. */
export function volumeDiscount(model: string, runDays: number): number {
  if (model !== "DAY") return 0;
  if (runDays >= 30) return 0.15;
  if (runDays >= 14) return 0.1;
  return 0;
}

export type BookingQuote = {
  model: PricingModelCode;
  /** the slot's list rate */
  listRate: number;
  /** requested days (inclusive) */
  days: number;
  /** days actually bought (flat models round up to whole weeks / months) */
  run: number;
  /** flat models: number of days / weeks / months billed; performance: null */
  units: number | null;
  gross: number;
  discountPct: number;
  discount: number;
  /** media cost excl. GST — what the campaign may spend */
  net: number;
  gst: number;
  /** amount payable incl. GST */
  total: number;
  /** rate snapshot stored on the campaign (flat: list rate after volume discount; perf: list rate) */
  effectiveRate: number;
  /** campaign budget cap stored on the campaign (flat: 0 = schedule controls; perf: net) */
  budget: number;
};

/**
 * Quote a self-serve booking. Flat models: units × rate (− volume discount). Performance models (CPM/CPC/CLIP):
 * the advertiser's budget, billed on delivery and capped at that budget.
 */
export function quoteBooking(slot: { pricingModel: string; rate: number }, days: number, budget = 0): BookingQuote {
  const model = slot.pricingModel as PricingModelCode;
  const d = Math.max(1, Math.floor(days));
  if (isTimeBased(model)) {
    const unit = UNIT_DAYS[model] ?? 1;
    const units = Math.max(1, Math.ceil(d / unit - 1e-9));
    const run = units * unit;
    const gross = Math.round(units * slot.rate);
    const pct = volumeDiscount(model, run);
    const discount = Math.round(gross * pct);
    const net = gross - discount;
    const gst = Math.round(net * GST_RATE);
    const effectiveRate = Math.round(slot.rate * (1 - pct) * 100) / 100;
    return { model, listRate: slot.rate, days: d, run, units, gross, discountPct: pct, discount, net, gst, total: net + gst, effectiveRate, budget: 0 };
  }
  const net = Math.max(0, Math.round(budget));
  const gst = Math.round(net * GST_RATE);
  return { model, listRate: slot.rate, days: d, run: d, units: null, gross: net, discountPct: 0, discount: 0, net, gst, total: net + gst, effectiveRate: slot.rate, budget: net };
}

// ───────────── reach model (estimator) ─────────────

/** Reach facts for one advertiser position on a slot (from live stats, with sensible fallbacks). */
export type SlotReach = {
  /** impressions per day for one position */
  imp: number;
  ctr: number;
  /** click → order conversion (sample assumption) */
  cvr: number;
  impL: string;
  clkL: string;
  ctrL: string;
};

/** Fallback traffic model per slot when there is no delivery history yet (demo sample figures). */
export const REACH_FALLBACK: Record<string, Partial<SlotReach> & { imp: number; ctr: number; cvr: number }> = {
  H1: { imp: 14000, ctr: 0.018, cvr: 0.04 },
  H2: { imp: 24000, ctr: 0.009, cvr: 0.035 },
  H3: { imp: 17000, ctr: 0.011, cvr: 0.035 },
  H4: { imp: 2500, ctr: 0.02, cvr: 0.035 },
  H5: { imp: 15000, ctr: 0.012, cvr: 0.03, impL: "Video views" },
  H6: { imp: 2000, ctr: 0.03, cvr: 0.035, impL: "Reel views" },
  H7: { imp: 3000, ctr: 0.015, cvr: 0.03 },
  H8: { imp: 16000, ctr: 0.013, cvr: 0.035 },
  H9: { imp: 9000, ctr: 0.03, cvr: 0.02, clkL: "Coupon clips", ctrL: "Clip rate" },
  H10: { imp: 26000, ctr: 0.045, cvr: 0.035 },
  H11: { imp: 18000, ctr: 0.022, cvr: 0.035 },
  S1: { imp: 1500, ctr: 0.05, cvr: 0.04, impL: "Keyword searches" },
  S2: { imp: 9000, ctr: 0.032, cvr: 0.05 },
  S3: { imp: 20000, ctr: 0.026, cvr: 0.035 },
  S4: { imp: 12000, ctr: 0.014, cvr: 0.04 },
  P1: { imp: 15000, ctr: 0.02, cvr: 0.03 },
  P2: { imp: 10000, ctr: 0.009, cvr: 0.04 },
  C1: { imp: 3500, ctr: 0.055, cvr: 0.045 },
  C2: { imp: 1400, ctr: 0.03, cvr: 0.05, impL: "Order confirmations" },
  B1: { imp: 600, ctr: 0.25, cvr: 0.012, impL: "Store visits", clkL: "Product clicks", ctrL: "Click rate" },
  X1: { imp: 1400, ctr: 0.06, cvr: 0.2, impL: "Boxes delivered", clkL: "QR scans", ctrL: "Scan rate" },
};

export function reachFor(code: string, live?: { imp?: number | null; ctr?: number | null }): SlotReach {
  const f = REACH_FALLBACK[code] ?? { imp: 5000, ctr: 0.01, cvr: 0.03 };
  const imp = live?.imp && live.imp > 0 ? live.imp : f.imp;
  const ctr = live?.ctr && live.ctr > 0 ? live.ctr : f.ctr;
  return { imp, ctr, cvr: f.cvr, impL: f.impL ?? "Impressions", clkL: f.clkL ?? "Clicks", ctrL: f.ctrL ?? "CTR" };
}

export type Estimate = {
  perDay: number;
  timeBased: boolean;
  unitDays: number;
  imp: number;
  clicks: number;
  orders: number;
  sales: number;
  roas: number;
  ecpm: number;
};

/** Estimated delivery for `runDays` of a slot (ROAS uses the store's average order value). */
export function estimateDelivery(slot: { code: string; pricingModel: string; rate: number }, reach: SlotReach, runDays: number, net: number, aov: number): Estimate {
  const clicksPerDay = reach.imp * reach.ctr;
  const perDay =
    slot.pricingModel === "BOX" ? reach.imp * slot.rate : dailySpend(slot.pricingModel, slot.rate, { impressions: reach.imp, clicks: clicksPerDay });
  const imp = reach.imp * runDays;
  const clicks = imp * reach.ctr;
  const orders = clicks * reach.cvr;
  const sales = orders * aov;
  return {
    perDay,
    timeBased: isTimeBased(slot.pricingModel),
    unitDays: UNIT_DAYS[slot.pricingModel as PricingModelCode] ?? 1,
    imp,
    clicks,
    orders,
    sales,
    roas: net > 0 ? sales / net : 0,
    ecpm: imp > 0 ? (net / imp) * 1000 : 0,
  };
}

/** Whole-day span between two ISO dates (inclusive); 0 when invalid or reversed. */
export function daySpan(startIso: string, endIso: string): number {
  const a = parseIsoDate(startIso);
  const b = parseIsoDate(endIso);
  if (!a || !b) return 0;
  const d = Math.round((b.getTime() - a.getTime()) / 864e5) + 1;
  return d > 0 ? d : 0;
}

export function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) || dt.getUTCDate() !== d ? null : dt;
}

export function formatRupees(n: number): string {
  return inr(n);
}
