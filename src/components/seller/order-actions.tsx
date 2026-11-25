"use client";
/**
 * Fulfilment buttons for one order (my items only): Confirm → Pack → Ship (courier + AWB dialog).
 * Calls POST /api/v1/seller/orders/:number/fulfil and refreshes the server-rendered list.
 */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, ApiFailure, errorText } from "./api";
import { SLink } from "./link";

export const COURIER_OPTIONS = ["Delhivery", "Blue Dart", "DTDC", "Ekart", "Xpressbees", "Ecom Express", "Shadowfax", "Shiprocket", "India Post", "Other"];

type Props = {
  number: string;
  /** counts of my items at each status */
  placed: number;
  confirmed: number;
  packed: number;
  compact?: boolean;
  showDetails?: boolean;
};

export function OrderActions({ number, placed, confirmed, packed, compact, showDetails = true }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dlg = useRef<HTMLDialogElement>(null);
  const [courier, setCourier] = useState("Delhivery");
  const [awb, setAwb] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  async function run(action: "confirm" | "pack" | "ship", extra: Record<string, string> = {}) {
    setBusy(action);
    try {
      const out = await api<{ updated: number }>(`/api/v1/seller/orders/${encodeURIComponent(number)}/fulfil`, { body: { action, ...extra } });
      const verb = action === "confirm" ? "confirmed" : action === "pack" ? "marked packed" : "marked shipped";
      toast(`${number}: ${out.updated} ${out.updated === 1 ? "item" : "items"} ${verb}`, { icon: action === "ship" ? "truck" : "check" });
      if (action === "ship") dlg.current?.close();
      startTransition(() => router.refresh());
    } catch (e) {
      if (e instanceof ApiFailure && Object.keys(e.fields).length) {
        setFieldErr(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, v?.[0] ?? ""])));
      }
      toast(errorText(e), { icon: "info" });
    } finally {
      setBusy(null);
    }
  }

  function openShip() {
    setFieldErr({});
    dlg.current?.showModal();
  }

  const any = placed + confirmed + packed > 0;

  return (
    <div className="sl-order-act">
      {placed > 0 ? (
        <button type="button" className="btn btn-cart btn-sm" onClick={() => run("confirm")} disabled={!!busy} aria-busy={(busy === "confirm") || undefined}>
          <Icon name="check" /> {busy === "confirm" ? "Confirming…" : placed > 1 ? `Confirm ${placed} items` : "Confirm order"}
        </button>
      ) : null}
      {confirmed > 0 || (placed > 0 && !compact) ? (
        <button type="button" className={placed > 0 ? "btn btn-ghost btn-sm" : "btn btn-cart btn-sm"} onClick={() => run("pack")} disabled={!!busy} aria-busy={(busy === "pack") || undefined}>
          <Icon name="box" /> {busy === "pack" ? "Saving…" : placed > 0 ? "Confirm & mark packed" : "Mark packed"}
        </button>
      ) : null}
      {packed > 0 ? (
        <button type="button" className="btn btn-cart btn-sm" onClick={openShip} disabled={!!busy}>
          <Icon name="truck" /> Ship {packed > 1 ? `${packed} items` : "order"}
        </button>
      ) : null}
      {any ? (
        <SLink href={`/seller/orders/${number}/slip`} className="btn btn-ghost btn-sm" prefetch={false}>
          <Icon name="layers" /> Packing slip
        </SLink>
      ) : null}
      {showDetails ? (
        <SLink href={`/seller/orders/${number}`} className={any ? "link" : "btn btn-ghost btn-sm"} style={any ? { justifyContent: "center", fontSize: 13 } : undefined}>
          View details <Icon name="arrow" />
        </SLink>
      ) : null}

      <dialog ref={dlg} className="sl-dlg" aria-labelledby={`ship-${number}`}>
        <form
          className="sl-dlg-in"
          onSubmit={(e) => {
            e.preventDefault();
            const errs: Record<string, string> = {};
            if (!courier) errs.courier = "Choose the courier";
            const clean = awb.replace(/\s+/g, "");
            if (!/^[A-Za-z0-9-]{6,40}$/.test(clean)) errs.trackingNumber = "Enter the AWB / tracking number (6–40 letters or numbers)";
            setFieldErr(errs);
            if (Object.keys(errs).length) return;
            run("ship", { courier, trackingNumber: clean.toUpperCase() });
          }}
        >
          <div className="sl-dlg-h">
            <div>
              <h2 id={`ship-${number}`}>Ship {number}</h2>
              <p>The shopper sees the courier and tracking number on their order as soon as you save.</p>
            </div>
            <button type="button" className="ib-sm" aria-label="Close" onClick={() => dlg.current?.close()}>
              <Icon name="close" />
            </button>
          </div>
          <label className="sl-field">
            <span>Courier</span>
            <select value={courier} onChange={(e) => setCourier(e.target.value)} aria-invalid={!!fieldErr.courier}>
              {COURIER_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {fieldErr.courier ? <small className="sl-err">{fieldErr.courier}</small> : null}
          </label>
          <label className="sl-field">
            <span>AWB / tracking number</span>
            <input
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              placeholder="e.g. 1490 8820 3317"
              autoComplete="off"
              inputMode="text"
              aria-invalid={!!fieldErr.trackingNumber}
              autoFocus
            />
            {fieldErr.trackingNumber ? <small className="sl-err">{fieldErr.trackingNumber}</small> : <small>Printed on the courier label / manifest.</small>}
          </label>
          <div className="sl-actions">
            <span className="sl-spacer" />
            <button type="button" className="btn btn-ghost" onClick={() => dlg.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-cart" disabled={busy === "ship"} aria-busy={(busy === "ship") || undefined}>
              <Icon name="truck" /> {busy === "ship" ? "Saving…" : "Mark shipped"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
