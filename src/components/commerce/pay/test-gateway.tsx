"use client";
/**
 * Built-in TEST payment gateway (used while no Razorpay keys are configured). Looks like a hosted gateway
 * page; "Pay" approves and "Fail payment" declines through POST /api/v1/payments/test/:paymentId.
 */
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { formatINR } from "@/lib/money";
import type { TestPaymentView } from "@/server/payments/service";
import { useCart } from "@/components/cart/cart-context";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { capi, errMessage, plural } from "../api";
import { XIcon } from "../parts";

const METHODS = [
  { k: "UPI", label: "UPI", icon: "upi" as const },
  { k: "CARD", label: "Card", icon: "card" as const },
  { k: "NETBANKING", label: "Net banking", icon: "bank" as const },
];

const tick = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
const nowSec = () => Math.floor(Date.now() / 1000);
const WINDOW_MS = 30 * 60_000;

export function TestGateway({ p }: { p: TestPaymentView }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [method, setMethod] = useState(p.method && METHODS.some((m) => m.k === p.method) ? p.method : "UPI");
  const [busy, setBusy] = useState<"success" | "failure" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sec = useSyncExternalStore(tick, nowSec, () => null);
  const now = sec == null ? null : sec * 1000;
  const mounted = sec != null;

  const left = now == null ? null : Math.max(0, new Date(p.createdAt).getTime() + WINDOW_MS - now);
  const mm = left == null ? "30" : String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = left == null ? "00" : String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  const submit = async (outcome: "success" | "failure") => {
    if (busy) return;
    setBusy(outcome);
    setError(null);
    try {
      const r = await capi<{ redirect: string; status: string }>(`/api/v1/payments/test/${encodeURIComponent(p.id)}`, { method: "POST", json: { outcome } });
      await refresh();
      // a failed payment goes back to checkout with a fresh page (not the router's preserved checkout state)
      if (outcome === "failure") window.location.assign(r.redirect);
      else router.replace(r.redirect);
    } catch (e) {
      setError(errMessage(e));
      setBusy(null);
    }
  };

  return (
    <div className="pg-card">
      <div className="pg-top">
        <span className="pg-merchant">
          <i aria-hidden="true">tbb</i>
          <span>
            <b>The Big Brands</b>
            <small>Order {p.orderNumber}</small>
          </span>
        </span>
        <span className="pg-mode">Test mode</span>
      </div>
      <div className="pg-amt">
        <small>Amount payable</small>
        <b>{formatINR(p.amount)}</b>
        <span>
          {plural(p.itemCount, "item")}
          {p.giftCount ? ` + ${plural(p.giftCount, "free gift")}` : ""}
        </span>
      </div>
      <div className="pg-methods" role="tablist" aria-label="Payment method">
        {METHODS.map((m) => (
          <button key={m.k} type="button" role="tab" aria-selected={method === m.k} className={cx("pg-m", method === m.k && "is-on")} onClick={() => setMethod(m.k)}>
            {m.icon === "card" ? <Icon name="card" /> : <XIcon name={m.icon} />}
            {m.label}
          </button>
        ))}
      </div>
      <p className="pg-note">
        <Icon name="info" />
        <span>
          This is the <b>built-in test gateway</b> — no real {method === "UPI" ? "UPI request" : method === "CARD" ? "card" : "bank"} is involved and no money moves. Choose an outcome to see how the store handles it.
        </span>
      </p>
      {error ? (
        <p className="cm-alert is-err" role="alert">
          <Icon name="info" />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="pg-acts">
        <button type="button" className="btn btn-cart btn-lg" onClick={() => submit("success")} disabled={busy !== null || left === 0}>
          {busy === "success" ? (
            <>
              <span className="co-spin" aria-hidden="true" />
              Processing…
            </>
          ) : (
            <>Pay {formatINR(p.amount)}</>
          )}
        </button>
        <button type="button" className="btn btn-ghost btn-lg pg-fail" onClick={() => submit("failure")} disabled={busy !== null}>
          {busy === "failure" ? "Declining…" : "Fail payment"}
        </button>
      </div>
      <div className="pg-foot">
        <span>
          <Icon name="clock" /> Order reserved for{" "}
          <b suppressHydrationWarning>
            {mounted ? `${mm}:${ss}` : "30:00"}
          </b>
        </span>
        <span>
          <XIcon name="lock" /> Secured · 256-bit TLS
        </span>
      </div>
    </div>
  );
}
