import { route } from "@/lib/api";
import { publicGatewayConfig } from "@/lib/payments";
import { getShippingSettings } from "@/server/checkout/settings";

/**
 * GET /api/v1/payments/config  (public)
 * → { mode: "RAZORPAY"|"TEST", keyId, codEnabled, codFee, freeShippingMin, shippingFee } — for the mobile apps'
 * payment sheet. `keyId` is the public Razorpay key (null in TEST mode).
 */
export const GET = route({ auth: "public" }, async () => {
  const s = await getShippingSettings();
  return { ...publicGatewayConfig(), codEnabled: s.codEnabled, codFee: s.codFee, freeShippingMin: s.freeShippingMin, shippingFee: s.shippingFee };
});
