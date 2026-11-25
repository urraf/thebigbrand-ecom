"use client";
/** Client actions on an order: pay now (retry), cancel, request a return, copy a coupon code. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderItemView, PlaceResult } from "@/server/checkout/types";
import { useCart } from "@/components/cart/cart-context";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import { capi, errMessage } from "../api";
import { openRazorpay, PaymentDismissed } from "../checkout/razorpay";

export function PayNowButton({ number, label = "Complete payment", className = "btn btn-cart btn-lg" }: { number: string; label?: string; className?: string }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      const r = await capi<PlaceResult>(`/api/v1/orders/${encodeURIComponent(number)}/pay`, { method: "POST" });
      if (r.payment.razorpay) {
        const signed = await openRazorpay(r.payment.razorpay);
        await capi("/api/v1/payments/razorpay/verify", { method: "POST", json: signed });
        await refresh();
        router.refresh();
      } else if (r.redirect) {
        router.push(r.redirect);
        return;
      }
    } catch (e) {
      if (!(e instanceof PaymentDismissed)) toast(errMessage(e), { icon: "info" });
    }
    setBusy(false);
  };
  return (
    <button type="button" className={className} onClick={pay} disabled={busy}>
      {busy ? <span className="co-spin" aria-hidden="true" /> : <Icon name="card" />}
      {busy ? "Opening payment…" : label}
    </button>
  );
}

export function CancelOrderButton({ number, unpaid, className = "btn btn-ghost" }: { number: string; unpaid?: boolean; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    try {
      await capi(`/api/v1/orders/${encodeURIComponent(number)}/cancel`, { method: "POST", json: reason ? { reason } : {} });
      toast("Your order has been cancelled", { icon: "check" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast(errMessage(e), { icon: "info" });
    } finally {
      setBusy(false);
    }
  };
  if (!open) {
    return (
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Cancel order
      </button>
    );
  }
  return (
    <div className="cm-confirm" role="group" aria-label="Cancel this order">
      <p>
        <b>Cancel order {number}?</b>
        {unpaid ? " Nothing has been charged." : " Prepaid amounts are refunded to the original payment method in 5–7 working days."}
      </p>
      <label className="sr-only" htmlFor={`cx-${number}`}>
        Reason (optional)
      </label>
      <select id={`cx-${number}`} value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Reason (optional)</option>
        <option>Ordered by mistake</option>
        <option>Found a better price</option>
        <option>Delivery is too slow</option>
        <option>Want to change items or address</option>
        <option>Other</option>
      </select>
      <div className="cm-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>
          Keep order
        </button>
        <button type="button" className="btn btn-dark btn-sm" onClick={cancel} disabled={busy}>
          {busy ? "Cancelling…" : "Yes, cancel"}
        </button>
      </div>
    </div>
  );
}

const REASONS: [string, string][] = [
  ["DAMAGED", "Arrived damaged or leaking"],
  ["WRONG_ITEM", "Received the wrong item"],
  ["NOT_AS_DESCRIBED", "Not as described"],
  ["QUALITY", "Quality or authenticity concern"],
  ["REACTION", "Skin reaction / allergy"],
  ["OTHER", "Other"],
];

export function ReturnRequest({ number, items }: { number: string; items: Pick<OrderItemView, "id" | "name" | "qty" | "returnable" | "returnBy">[] }) {
  const router = useRouter();
  const returnable = items.filter((i) => i.returnable);
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>(returnable.length === 1 ? [returnable[0].id] : []);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!returnable.length) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ids.length) return setError("Choose the item(s) you want to return");
    if (!reason) return setError("Tell us why you're returning it");
    setBusy(true);
    setError(null);
    try {
      await capi(`/api/v1/orders/${encodeURIComponent(number)}/return`, { method: "POST", json: { itemIds: ids, reason, note: note || undefined } });
      toast("Return requested — we'll call you within 24 hours to arrange a free pickup", { icon: "check", duration: 5000 });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <Icon name="ret" /> Request a return
      </button>
    );
  }
  return (
    <form className="cm-return" onSubmit={submit}>
      <h3>Request a return</h3>
      <p className="muted">Free pickup from your address · refund within 5–7 days of pickup.</p>
      <fieldset>
        <legend className="cm-lbl">Items</legend>
        {returnable.map((i) => (
          <label key={i.id} className="cm-check">
            <input type="checkbox" checked={ids.includes(i.id)} onChange={(e) => setIds((v) => (e.target.checked ? [...v, i.id] : v.filter((x) => x !== i.id)))} />
            <span>
              {i.name}
              {i.qty > 1 ? ` ×${i.qty}` : ""}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="cm-lbl" htmlFor={`rr-${number}`}>
        Reason
      </label>
      <select id={`rr-${number}`} value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Select a reason</option>
        {REASONS.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <label className="cm-lbl" htmlFor={`rn-${number}`}>
        Anything else? <em>(optional)</em>
      </label>
      <textarea id={`rn-${number}`} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? (
        <p className="cm-alert is-err" role="alert">
          <Icon name="info" />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="cm-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-dark btn-sm" disabled={busy}>
          {busy ? "Sending…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

export function CopyCode({ code, message }: { code: string; message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cx("co-code", copied && "is-copied")}
      aria-label={`Copy code ${code}`}
      onClick={() => {
        try {
          void navigator.clipboard?.writeText(code).catch(() => {});
        } catch {
          /* clipboard unavailable */
        }
        setCopied(true);
        toast(message, { icon: "tag" });
      }}
    >
      <b>{code}</b>
      <span>
        <Icon name={copied ? "check" : "scissors"} />
        {copied ? "Copied" : "Copy code"}
      </span>
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-dark" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
