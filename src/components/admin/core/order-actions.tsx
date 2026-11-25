"use client";
/**
 * Order status controls (all go through POST /api/v1/admin/orders/:number/status or …/items/:itemId,
 * which call the order lifecycle). Shipping asks for courier + tracking number.
 */
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { ConfirmButton, Modal, SelectField, TextField, TextAreaField, useAdminAction } from "@/components/admin/ui";

type To = "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";

const META: Record<To, { label: string; icon: IconName; done: string; tone?: "danger" }> = {
  CONFIRMED: { label: "Confirm", icon: "check", done: "confirmed" },
  PACKED: { label: "Mark packed", icon: "box", done: "marked packed" },
  SHIPPED: { label: "Ship", icon: "truck", done: "shipped" },
  DELIVERED: { label: "Mark delivered", icon: "home", done: "marked delivered" },
  CANCELLED: { label: "Cancel", icon: "close", done: "cancelled", tone: "danger" },
  RETURNED: { label: "Mark returned", icon: "ret", done: "marked returned", tone: "danger" },
};

const FORWARD: To[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

function ShipDialog({ open, onClose, url, couriers, title, sub }: { open: boolean; onClose: () => void; url: string; couriers: string[]; title: string; sub: string }) {
  const [courier, setCourier] = useState(couriers[0] ?? "");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const { run, busy, lastError } = useAdminAction();
  async function submit() {
    const ok = await run(url, { method: "POST", body: { to: "SHIPPED", courier, trackingNumber: tracking || undefined, note: note || undefined } }, { success: "Shipped — tracking saved on the order", icon: "truck" });
    if (ok !== null) onClose();
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      size="sm"
      locked={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-dark" disabled={busy || !courier} aria-busy={busy || undefined}>
            <Icon name="truck" />
            {busy ? "Saving…" : "Mark shipped"}
          </button>
        </>
      }
    >
      <div className="am-form">
        <SelectField label="Courier" required value={courier} onChange={setCourier} options={couriers.map((c) => ({ value: c, label: c }))} error={lastError?.fields.courier} />
        <TextField label="Tracking / AWB number" value={tracking} onChange={setTracking} placeholder="e.g. 1490 2231 8842" maxLength={60} hint="Shown to the customer on their order page" mono />
        <TextAreaField label="Note (optional)" value={note} onChange={setNote} rows={2} maxLength={300} placeholder="Shown on the timeline" />
      </div>
    </Modal>
  );
}

/** Order-level buttons: the next forward step as the primary action + cancel/return. */
export function OrderActions({ number, next: nextRaw, couriers, compact }: { number: string; next: readonly string[]; couriers: string[]; compact?: boolean }) {
  const next = nextRaw.filter((t): t is To => t in META);
  const [ship, setShip] = useState(false);
  const url = `/api/v1/admin/orders/${encodeURIComponent(number)}/status`;
  const forward = FORWARD.filter((t) => next.includes(t));
  const primary = forward[0];
  const others = forward.slice(1);
  const btn = compact ? "btn btn-ghost btn-sm" : "btn btn-dark btn-sm";

  const step = (to: To, cls: string) =>
    to === "SHIPPED" ? (
      <button key={to} type="button" className={cls} onClick={() => setShip(true)}>
        <Icon name="truck" />
        {compact ? "Ship…" : "Ship order…"}
      </button>
    ) : (
      <ConfirmButton
        key={to}
        url={url}
        body={{ to }}
        className={cls}
        confirm={`${META[to].label} order ${number}?`}
        message={
          to === "DELIVERED"
            ? "Every shipped item is marked delivered. Seller earnings are credited to their ledger and COD orders are marked paid."
            : `Every item that can move is marked ${META[to].done.replace("marked ", "")}. The customer sees it on their order page.`
        }
        confirmLabel={META[to].label}
        tone={to === "DELIVERED" ? "ok" : "primary"}
        success={`Order ${number} ${META[to].done}`}
        icon={META[to].icon}
      >
        <Icon name={META[to].icon} />
        {META[to].label}
      </ConfirmButton>
    );

  if (compact) {
    return primary ? (
      <>
        {step(primary, btn)}
        {primary === "SHIPPED" ? <ShipDialog open={ship} onClose={() => setShip(false)} url={url} couriers={couriers} title={`Ship order ${number}`} sub="All packed and confirmed items ship together" /> : null}
      </>
    ) : null;
  }

  return (
    <>
      {primary ? step(primary, btn) : null}
      {others.map((t) => step(t, "btn btn-ghost btn-sm"))}
      {next.includes("CANCELLED") ? (
        <ConfirmButton
          url={url}
          body={{ to: "CANCELLED" }}
          className="btn btn-ghost btn-sm"
          confirm={`Cancel order ${number}?`}
          message="Items not yet shipped are cancelled and their stock is returned. Prepaid orders need a refund afterwards."
          confirmLabel="Cancel order"
          tone="danger"
          reason={{ label: "Reason (shown on the timeline)", field: "note", placeholder: "Customer asked to cancel / out of stock…" }}
          success={`Order ${number} cancelled`}
          icon="close"
        >
          <Icon name="close" />
          Cancel order
        </ConfirmButton>
      ) : null}
      {next.includes("RETURNED") ? (
        <ConfirmButton
          url={url}
          body={{ to: "RETURNED" }}
          className="btn btn-ghost btn-sm"
          confirm={`Mark order ${number} returned?`}
          message="Delivered items are marked returned, stock is restored and seller earnings are reversed."
          confirmLabel="Mark returned"
          tone="danger"
          reason={{ label: "Return reason", field: "note", placeholder: "Damaged in transit / wrong shade…" }}
          success={`Order ${number} marked returned`}
          icon="ret"
        >
          <Icon name="ret" />
          Mark returned
        </ConfirmButton>
      ) : null}
      {next.includes("SHIPPED") ? <ShipDialog open={ship} onClose={() => setShip(false)} url={url} couriers={couriers} title={`Ship order ${number}`} sub="Every confirmed or packed item ships with this courier" /> : null}
    </>
  );
}

/** Per-line actions inside the order detail. */
export function ItemActions({ number, itemId, name, next: nextRaw, couriers }: { number: string; itemId: string; name: string; next: readonly string[]; couriers: string[] }) {
  const next = nextRaw.filter((t): t is To => t in META);
  const [ship, setShip] = useState(false);
  if (!next.length) return null;
  const url = `/api/v1/admin/orders/${encodeURIComponent(number)}/items/${itemId}`;
  return (
    <div className="am-iact">
      {next.map((to) =>
        to === "SHIPPED" ? (
          <button key={to} type="button" className="btn btn-ghost btn-sm" onClick={() => setShip(true)}>
            <Icon name="truck" />
            Ship
          </button>
        ) : (
          <ConfirmButton
            key={to}
            url={url}
            body={{ to }}
            className={META[to].tone ? "btn btn-ghost btn-sm am-iact-x" : "btn btn-ghost btn-sm"}
            confirm={`${META[to].label}: ${name}?`}
            message={to === "CANCELLED" ? "Stock for this line is returned. The rest of the order is unaffected." : to === "RETURNED" ? "Stock is restored and any seller earning for this line is reversed." : undefined}
            confirmLabel={META[to].label}
            tone={META[to].tone ?? (to === "DELIVERED" ? "ok" : "primary")}
            reason={META[to].tone ? { label: "Reason", field: "note", placeholder: "Optional" } : undefined}
            success={`Item ${META[to].done}`}
            icon={META[to].icon}
          >
            {META[to].label}
          </ConfirmButton>
        ),
      )}
      {next.includes("SHIPPED") ? <ShipDialog open={ship} onClose={() => setShip(false)} url={url} couriers={couriers} title="Ship this item" sub={name} /> : null}
    </div>
  );
}

/** Internal note on the timeline. */
export function NoteForm({ number }: { number: string }) {
  const [note, setNote] = useState("");
  const { run, busy } = useAdminAction();
  return (
    <form
      className="am-note"
      onSubmit={async (e) => {
        e.preventDefault();
        if (note.trim().length < 2) return;
        const ok = await run(`/api/v1/admin/orders/${encodeURIComponent(number)}/notes`, { method: "POST", body: { note: note.trim() } }, { success: "Note added to the timeline", icon: "check" });
        if (ok !== null) setNote("");
      }}
    >
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note (customer called, address corrected…)" maxLength={500} aria-label="Internal note" />
      <button type="submit" className="btn btn-ghost btn-sm" disabled={busy || note.trim().length < 2}>
        {busy ? "Adding…" : "Add note"}
      </button>
    </form>
  );
}

export function RefundButton({ number, amount }: { number: string; amount: string }) {
  return (
    <ConfirmButton
      url={`/api/v1/admin/orders/${encodeURIComponent(number)}/refund`}
      body={{}}
      className="btn btn-ghost btn-sm"
      confirm={`Record refund of ${amount}?`}
      message="Use this after you've refunded the money in the Razorpay dashboard. The order's payment is marked refunded."
      confirmLabel="Record refund"
      reason={{ label: "Refund reference (optional)", field: "note", placeholder: "Razorpay refund id rfnd_…" }}
      success="Refund recorded"
      icon="ret"
    >
      <Icon name="ret" />
      Record refund
    </ConfirmButton>
  );
}
