import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { site } from "@/lib/site";

/**
 * Delivery / COD settings (Setting "shipping", edited in the admin console → invalidate(TAGS.settings)).
 * Falls back to the site defaults when the row is missing or malformed.
 */
export type ShippingSettings = {
  freeShippingMin: number;
  shippingFee: number;
  codEnabled: boolean;
  codFee: number;
  partner: string | null;
};

const int = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback);

export async function getShippingSettings(): Promise<ShippingSettings> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);
  const row = await db.setting.findUnique({ where: { key: "shipping" }, select: { value: true } });
  return parseShippingSettings(row?.value);
}

/** Setting "shipping" JSON → ShippingSettings (defaults for anything missing). Order placement reads it uncached. */
export function parseShippingSettings(value: unknown): ShippingSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    freeShippingMin: int(v.freeShippingMin, site.freeShippingMin),
    shippingFee: int(v.shippingFee, site.shippingFee),
    codEnabled: typeof v.codEnabled === "boolean" ? v.codEnabled : true,
    codFee: int(v.codFee, site.codFee),
    partner: typeof v.partner === "string" ? v.partner : null,
  };
}

/** Delivery fee for a cart subtotal (₹0 for an empty cart or at/over the free-delivery threshold). */
export function deliveryFee(subtotal: number, s: ShippingSettings): number {
  return subtotal <= 0 || subtotal >= s.freeShippingMin ? 0 : s.shippingFee;
}
