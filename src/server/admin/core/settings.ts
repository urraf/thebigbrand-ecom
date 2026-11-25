import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { gatewayMode } from "@/lib/payments";

/**
 * Store settings kept in `Setting` rows (key → JSON). Keys and field names are a contract with the storefront
 * and checkout (they read `shipping` for fees and `trending` for search suggestions) — extend, don't rename.
 */
export const StoreSettings = z.object({
  name: z.string().trim().min(2).max(80),
  legalName: z.string().trim().min(2).max(120),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z0-9]{13}$/, "GSTIN is 15 characters, e.g. 07AAKCT4821M1Z5")
    .or(z.literal("")),
  supportEmail: z.string().trim().email(),
  supportPhone: z.string().trim().min(6).max(20),
  address: z.string().trim().max(240).default(""),
  invoicePrefix: z.string().trim().max(10).default("TBB"),
});

export const ShippingSettings = z
  .object({
    shippingFee: z.coerce.number().int().min(0).max(999),
    freeShippingMin: z.coerce.number().int().min(0).max(100000),
    codEnabled: z.boolean(),
    codFee: z.coerce.number().int().min(0).max(999),
    codMaxOrder: z.coerce.number().int().min(0).max(100000).default(0), // 0 = no limit
    partner: z.string().trim().max(60).default("Shiprocket"),
    dispatchDays: z.coerce.number().int().min(0).max(14).default(1),
  });

export const TrendingSettings = z.array(z.string().trim().min(2).max(40)).max(12);

export type StoreSettings = z.infer<typeof StoreSettings>;
export type ShippingSettings = z.infer<typeof ShippingSettings>;

const DEFAULT_STORE: StoreSettings = {
  name: site.name,
  legalName: "TBB Retail Pvt Ltd",
  gstin: "",
  supportEmail: site.supportEmail,
  supportPhone: site.supportPhone,
  address: "",
  invoicePrefix: "TBB",
};
const DEFAULT_SHIPPING: ShippingSettings = {
  shippingFee: site.shippingFee,
  freeShippingMin: site.freeShippingMin,
  codEnabled: true,
  codFee: site.codFee,
  codMaxOrder: 0,
  partner: "Shiprocket",
  dispatchDays: 1,
};

function merge<T extends object>(def: T, raw: unknown): T {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...def, ...(raw as Partial<T>) } : def;
}

export async function getSettings() {
  const rows = await db.setting.findMany({ where: { key: { in: ["store", "shipping", "trending"] } } });
  const by = new Map(rows.map((r) => [r.key, r]));
  const trendingRaw = by.get("trending")?.value;
  return {
    store: merge(DEFAULT_STORE, by.get("store")?.value),
    shipping: merge(DEFAULT_SHIPPING, by.get("shipping")?.value),
    trending: Array.isArray(trendingRaw) ? (trendingRaw.filter((x) => typeof x === "string") as string[]) : [],
    updatedAt: Object.fromEntries(rows.map((r) => [r.key, r.updatedAt.toISOString()])) as Record<string, string>,
  };
}

/** Read-only payment/integration status derived from environment variables (secrets never leave the server). */
export function integrationStatus() {
  const mask = (s: string) => (s ? `${s.slice(0, 8)}…${s.slice(-4)}` : null);
  return {
    gateway: {
      mode: gatewayMode(),
      keyId: env.razorpay.enabled ? mask(env.razorpay.keyId) : null,
      live: env.razorpay.keyId.startsWith("rzp_live_"),
      webhookConfigured: Boolean(env.razorpay.webhookSecret),
    },
    sms: { provider: env.msg91.enabled ? "MSG91" : "Dev mode (OTP shown on screen)", enabled: env.msg91.enabled, devOtp: env.otpDevMode },
    storage: { driver: env.storage.driver, configured: env.storage.driver === "local" || Boolean(env.storage.blobToken) },
    appUrl: env.appUrl,
  };
}

export const SettingsPatch = z
  .object({
    store: StoreSettings.partial().optional(),
    shipping: ShippingSettings.partial().optional(),
    trending: TrendingSettings.optional(),
  })
  .refine((v) => v.store || v.shipping || v.trending, { message: "Nothing to update" });

/** Merge-patch settings sections; validates the merged result. Returns the new settings. */
export async function updateSettings(patch: z.infer<typeof SettingsPatch>) {
  const cur = await getSettings();
  const writes: Array<{ key: string; value: Prisma.InputJsonValue }> = [];
  if (patch.store) writes.push({ key: "store", value: StoreSettings.parse({ ...cur.store, ...patch.store }) });
  if (patch.shipping) writes.push({ key: "shipping", value: ShippingSettings.parse({ ...cur.shipping, ...patch.shipping }) });
  if (patch.trending) {
    const uniq = [...new Set(patch.trending.map((t) => t.toLowerCase()))];
    writes.push({ key: "trending", value: uniq });
  }
  await db.$transaction(writes.map((w) => db.setting.upsert({ where: { key: w.key }, create: { key: w.key, value: w.value }, update: { value: w.value } })));
  return { sections: writes.map((w) => w.key), settings: await getSettings() };
}
