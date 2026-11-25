"use client";
/** Payment step for a booked campaign — TEST gateway (demo) or Razorpay Checkout (live keys). */
import { useState } from "react";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { errorText } from "./api";
import { confirmTestPayment, freshPayment, payWithRazorpay, type GatewayPayment } from "./pz-pay";

type Props = {
  code: string;
  payment: GatewayPayment | null;
  prefill: { name?: string; email?: string; contact?: string };
  onPaid: () => void;
  compact?: boolean;
};

export function PayPanel({ code, payment: initial, prefill, onPaid, compact }: Props) {
  const [payment, setPayment] = useState<GatewayPayment | null>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function ensure(): Promise<GatewayPayment> {
    if (payment && payment.status === "PENDING") return payment;
    const p = await freshPayment(code);
    setPayment(p);
    return p;
  }

  async function pay(outcome: "success" | "failure" = "success") {
    setBusy(outcome);
    try {
      const p = await ensure();
      if (p.mode === "TEST") {
        await confirmTestPayment(code, outcome);
        toast(`Paid ${formatINR(p.amount)} — ${code} is in review`, { icon: "check" });
        onPaid();
      } else {
        const ok = await payWithRazorpay(code, p, prefill);
        if (ok) {
          toast(`Payment received — ${code} is in review`, { icon: "check" });
          onPaid();
        }
      }
    } catch (e) {
      toast(errorText(e), { icon: "info" });
      setPayment(null); // a failed attempt needs a fresh gateway order
    } finally {
      setBusy(null);
    }
  }

  const amount = payment?.amount;
  const isTest = !payment || payment.mode === "TEST";

  if (compact) {
    return (
      <button type="button" className="btn btn-cart btn-sm" onClick={() => pay("success")} disabled={!!busy} aria-busy={!!busy || undefined}>
        <Icon name="card" /> {busy ? "Opening…" : amount ? `Pay ${formatINR(amount)}` : "Pay now"}
      </button>
    );
  }

  return (
    <div className="sl-note sl-note-warn" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <Icon name="card" />
      <span style={{ flex: "1 1 240px" }}>
        <b>Payment due{amount ? `: ${formatINR(amount)} incl. 18% GST` : ""}.</b> We review your campaign once it&apos;s paid. It spends only on real clicks, capped at your budget.
        {isTest ? <> (Demo mode: the built-in test gateway is used — no real money moves.)</> : null}
      </span>
      <span className="sl-actions">
        {isTest ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => pay("failure")} disabled={!!busy} aria-busy={(busy === "failure") || undefined}>
            {busy === "failure" ? "…" : "Simulate failure"}
          </button>
        ) : null}
        <button type="button" className="btn btn-cart btn-sm" onClick={() => pay("success")} disabled={!!busy} aria-busy={(busy === "success") || undefined}>
          <Icon name="check" /> {busy === "success" ? "Processing…" : isTest ? "Pay with test gateway" : "Pay securely"}
        </button>
      </span>
    </div>
  );
}
