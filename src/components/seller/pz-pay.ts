/**
 * Paying for a sponsored-product booking (ads area contract):
 *   POST /api/v1/ads/book/:code/pay          → fresh pending gateway order (retry / pay later)
 *   POST /api/v1/ads/book/:code/pay/verify   → Razorpay signature, or { test: true, outcome } on the TEST gateway
 */
import { api } from "./api";

export type GatewayPayment = { id: string; mode: "RAZORPAY" | "TEST"; keyId: string | null; providerOrderId: string | null; amount: number; currency: string; status: string };

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: () => void) => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Payment window failed to load")));
    s.onerror = () => reject(new Error("Couldn't reach Razorpay — check your connection"));
    document.head.appendChild(s);
  });
}

export async function freshPayment(code: string): Promise<GatewayPayment> {
  const view = await api<{ payment: GatewayPayment | null }>(`/api/v1/ads/book/${encodeURIComponent(code)}/pay`, { method: "POST" });
  if (!view.payment) throw new Error("No payment is due for this campaign");
  return view.payment;
}

/** TEST gateway: confirm success/failure. */
export function confirmTestPayment(code: string, outcome: "success" | "failure") {
  return api(`/api/v1/ads/book/${encodeURIComponent(code)}/pay/verify`, { body: { test: true, outcome } });
}

/** Razorpay Checkout → verify signature server-side. Resolves true when paid, false when the window was closed. */
export async function payWithRazorpay(code: string, p: GatewayPayment, prefill: { name?: string; email?: string; contact?: string }) {
  const Razorpay = await loadRazorpay();
  return new Promise<boolean>((resolve, reject) => {
    const rz = new Razorpay({
      key: p.keyId,
      order_id: p.providerOrderId,
      amount: p.amount * 100,
      currency: p.currency,
      name: "The Big Brands",
      description: `Sponsored products · ${code}`,
      prefill,
      theme: { color: "#ff3d6e" },
      handler: async (r: RazorpayResponse) => {
        try {
          await api(`/api/v1/ads/book/${encodeURIComponent(code)}/pay/verify`, { body: r });
          resolve(true);
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve(false) },
    });
    rz.open();
  });
}
