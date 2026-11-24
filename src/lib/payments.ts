import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { toPaise } from "@/lib/money";

/**
 * Payment gateway adapter.
 * - When RAZORPAY_KEY_ID/SECRET are set → real Razorpay (Orders API + Checkout.js + signature verification).
 * - Otherwise → built-in TEST gateway: the app shows its own "Test payment" screen that can succeed or fail.
 * Amounts in and out of this module are RUPEES (converted to paise internally for Razorpay).
 */

export type GatewayMode = "RAZORPAY" | "TEST";

export function gatewayMode(): GatewayMode {
  return env.razorpay.enabled ? "RAZORPAY" : "TEST";
}

export function publicGatewayConfig() {
  return { mode: gatewayMode(), keyId: env.razorpay.enabled ? env.razorpay.keyId : null };
}

export type GatewayOrder = { providerOrderId: string; amount: number; currency: "INR"; mode: GatewayMode };

/** Create a gateway order for `amount` rupees. `receipt` = our order number / campaign code. */
export async function createGatewayOrder(amount: number, receipt: string, notes: Record<string, string> = {}): Promise<GatewayOrder> {
  if (!env.razorpay.enabled) {
    return { providerOrderId: `test_${receipt}_${Date.now().toString(36)}`, amount, currency: "INR", mode: "TEST" };
  }
  const auth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: toPaise(amount), currency: "INR", receipt: receipt.slice(0, 40), notes }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay order creation failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id: string };
  return { providerOrderId: json.id, amount, currency: "INR", mode: "RAZORPAY" };
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Verify the signature Razorpay Checkout returns to the browser. */
export function verifyCheckoutSignature(providerOrderId: string, providerPaymentId: string, signature: string): boolean {
  if (!env.razorpay.enabled) return false;
  const expected = createHmac("sha256", env.razorpay.keySecret).update(`${providerOrderId}|${providerPaymentId}`).digest("hex");
  return /^[a-f0-9]+$/i.test(signature) && safeEqualHex(expected, signature);
}

/** Verify a Razorpay webhook (`x-razorpay-signature` header) against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.razorpay.webhookSecret || !signature) return false;
  const expected = createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");
  return /^[a-f0-9]+$/i.test(signature) && safeEqualHex(expected, signature);
}
