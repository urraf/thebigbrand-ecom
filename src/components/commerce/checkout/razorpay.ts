/**
 * Razorpay Checkout.js — loaded on demand (only when the gateway is live and the shopper pays online).
 * Opens the payment sheet for a server-created gateway order and resolves with the signed result,
 * or rejects with "dismissed" / the failure description.
 */
import type { PlaceResult } from "@/server/checkout/types";

type RzpSuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpInstance = { open: () => void; on: (evt: string, cb: (r: { error?: { description?: string } }) => void) => void };
type RzpCtor = new (opts: Record<string, unknown>) => RzpInstance;

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<RzpCtor> | null = null;

function loadScript(): Promise<RzpCtor> {
  const w = window as unknown as { Razorpay?: RzpCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  if (loading) return loading;
  loading = new Promise<RzpCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't reach the payment gateway — check your connection and try again"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export class PaymentDismissed extends Error {
  constructor() {
    super("dismissed");
  }
}

export async function openRazorpay(rzp: NonNullable<PlaceResult["payment"]["razorpay"]>): Promise<RzpSuccess> {
  const Razorpay = await loadScript();
  return new Promise<RzpSuccess>((resolve, reject) => {
    let settled = false;
    const inst = new Razorpay({
      key: rzp.keyId,
      order_id: rzp.orderId,
      amount: rzp.amountPaise,
      currency: rzp.currency,
      name: rzp.name,
      description: rzp.description,
      prefill: rzp.prefill,
      theme: { color: "#ff3d6e" },
      handler: (r: RzpSuccess) => {
        settled = true;
        resolve(r);
      },
      modal: {
        ondismiss: () => {
          if (!settled) reject(new PaymentDismissed());
        },
        confirm_close: true,
      },
    });
    inst.on("payment.failed", (r) => {
      // Razorpay keeps the sheet open so the shopper can retry; we only note the reason
      console.warn("[razorpay] payment failed", r.error?.description);
    });
    inst.open();
  });
}
