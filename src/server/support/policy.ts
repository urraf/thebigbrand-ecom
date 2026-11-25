import "server-only";
import { getStoreInfo, type StoreInfo } from "@/server/catalog/data";
import { getGiftProgramme } from "@/server/catalog/offers";
import { getShippingSettings, type ShippingSettings } from "@/server/checkout/settings";
import { formatINR } from "@/lib/money";

/**
 * Live facts the policy pages quote (fees, thresholds, return window, company details), so the text never
 * drifts from what checkout and the order flows actually do. All reads are cached ("use cache" upstream).
 */

export const POLICY_UPDATED = "25 November 2026";
/** Must match RETURN_WINDOW_DAYS in src/server/orders/customer.ts */
export const RETURN_DAYS = 7;
/** Unpaid online orders are cancelled after this many minutes (cron expire-orders). */
export const UNPAID_EXPIRY_MIN = 30;
export const REFUND_DAYS = "5–7 working days";
export const SUPPORT_HOURS = "9 am – 9 pm, all days";
/** Courts with exclusive jurisdiction — confirm with the client's legal team before launch. */
export const JURISDICTION = "New Delhi";

export type PolicyFacts = {
  store: StoreInfo;
  ship: ShippingSettings;
  grievance: { name: string; email: string };
  freeShipping: string;
  shippingFee: string;
  codFee: string;
  giftLine: string;
};

export async function getPolicyFacts(): Promise<PolicyFacts> {
  const [store, ship, gifts] = await Promise.all([getStoreInfo(), getShippingSettings(), getGiftProgramme()]);
  const tiers = gifts.tiers.length ? gifts.tiers : [{ minAmount: 0, giftCount: 1 }];
  const giftLine = tiers
    .map((t) => `${t.giftCount} free gift${t.giftCount > 1 ? "s" : ""} ${t.minAmount > 0 ? `on orders of ${formatINR(t.minAmount)} or more` : "on every order"}`)
    .join(", ");
  return {
    store,
    ship,
    grievance: { name: store.grievanceName || "Grievance Officer", email: store.grievanceEmail || store.supportEmail },
    freeShipping: formatINR(ship.freeShippingMin),
    shippingFee: formatINR(ship.shippingFee),
    codFee: ship.codFee > 0 ? formatINR(ship.codFee) : "no extra charge",
    giftLine,
  };
}
