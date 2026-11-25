/**
 * Display helpers for the seller portal (client-safe). Dates always render in IST so the server and the
 * browser produce identical text (no hydration drift).
 */

const TZ = "Asia/Kolkata";

const dDay = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const dDate = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const dShort = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short" });
const dTime = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

type D = Date | string | number | null | undefined;
const toDate = (d: D) => (d == null ? null : d instanceof Date ? d : new Date(d));

/** "Tue, 24 Nov" */
export const fmtDay = (d: D) => (toDate(d) ? dDay.format(toDate(d)!) : "—");
/** "24 Nov 2026" */
export const fmtDate = (d: D) => (toDate(d) ? dDate.format(toDate(d)!) : "—");
/** "24 Nov" */
export const fmtShort = (d: D) => (toDate(d) ? dShort.format(toDate(d)!) : "—");
/** "Tue, 24 Nov · 5:42 pm" */
export const fmtDayTime = (d: D) => (toDate(d) ? `${dDay.format(toDate(d)!)} · ${dTime.format(toDate(d)!).toLowerCase()}` : "—");

/** YYYY-MM-DD of a moment in IST (for date inputs and day buckets). */
export function istDateKey(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const ITEM_STATUS_LABEL: Record<string, string> = {
  PLACED: "New",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

/** pill colour modifier for item / product / campaign / payout statuses */
export const STATUS_TONE: Record<string, string> = {
  PLACED: "new",
  CONFIRMED: "pending",
  PACKED: "pending",
  SHIPPED: "shipped",
  DELIVERED: "ok",
  CANCELLED: "off",
  RETURNED: "crit",
  // products
  DRAFT: "off",
  PENDING: "pending",
  ACTIVE: "ok",
  REJECTED: "crit",
  ARCHIVED: "off",
  // campaigns
  PENDING_REVIEW: "pending",
  APPROVED: "ok",
  PAUSED: "off",
  ENDED: "off",
  // payouts
  PROCESSING: "shipped",
  PAID: "ok",
  FAILED: "crit",
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "In review",
  ACTIVE: "Live",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "In review",
  APPROVED: "Approved",
  PAUSED: "Paused",
  REJECTED: "Rejected",
  ENDED: "Ended",
};

export const LEDGER_LABEL: Record<string, string> = {
  SALE_CREDIT: "Sale",
  COMMISSION_DEBIT: "Commission",
  REFUND_DEBIT: "Return",
  PAYOUT: "Payout",
  AD_SPEND: "Ad spend",
  ADJUSTMENT: "Adjustment",
};

export const PAYOUT_LABEL: Record<string, string> = { PENDING: "Scheduled", PROCESSING: "Processing", PAID: "Paid", FAILED: "Failed" };

/** "+₹1,240" / "−₹150" with a real minus sign */
export function signedINR(n: number): string {
  const abs = "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
  return n < 0 ? `−${abs}` : n > 0 ? `+${abs}` : abs;
}

/** formatINR that renders negatives as "−₹101" (never "₹-101"). */
export function inr(n: number): string {
  const v = Math.round(n);
  return v < 0 ? `−₹${Math.abs(v).toLocaleString("en-IN")}` : `₹${v.toLocaleString("en-IN")}`;
}

/** Bank reference label: "UTR663642494" stays as-is, "663642494" → "UTR 663642494". */
export const utr = (ref: string | null | undefined) => (!ref ? "" : /^utr/i.test(ref) ? ref.toUpperCase() : `UTR ${ref}`);

export function initials(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "S") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
