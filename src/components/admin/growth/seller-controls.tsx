"use client";
/**
 * Seller admin islands:
 *  - SellerActions → POST /api/v1/admin/sellers/:id/action { approve | reject (reason) | suspend (reason) | reactivate }
 *  - CommissionEditor → PATCH /api/v1/admin/sellers/:id/commission (superadmin)
 *  - Reveal: masks bank account numbers until asked
 */
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ConfirmButton, NumberField, useAdminAction } from "@/components/admin/ui";

export function SellerActions({ id, name, status, size = "sm" }: { id: string; name: string; status: string; size?: "sm" | "md" }) {
  const url = `/api/v1/admin/sellers/${id}/action`;
  const sm = size === "sm" ? " btn-sm" : "";
  return (
    <div className="ag-actions">
      {status === "PENDING" || status === "REJECTED" ? (
        <ConfirmButton
          url={url}
          body={{ action: "approve" }}
          confirm={`Approve ${name}?`}
          message="They can sign in to the seller portal straight away, list products (each product still needs your approval) and receive payouts."
          confirmLabel="Approve seller"
          tone="ok"
          success={`${name} approved — seller portal unlocked`}
          className={`btn btn-cart${sm}`}
        >
          <Icon name="check" />
          Approve
        </ConfirmButton>
      ) : null}
      {status === "PENDING" ? (
        <ConfirmButton
          url={url}
          body={{ action: "reject" }}
          confirm={`Reject ${name}'s application?`}
          message="They see your reason on their application status page."
          confirmLabel="Reject application"
          tone="danger"
          reason={{ label: "Reason", field: "reason", required: true, placeholder: "e.g. GSTIN doesn't match the business name — please re-apply with the right documents" }}
          success={`${name} rejected`}
          className={`btn btn-ghost${sm}`}
        >
          Reject
        </ConfirmButton>
      ) : null}
      {status === "APPROVED" ? (
        <ConfirmButton
          url={url}
          body={{ action: "suspend" }}
          confirm={`Suspend ${name}?`}
          message="Their live products are taken off the store immediately and they lose access to the seller portal. Their ledger balance is kept."
          confirmLabel="Suspend seller"
          tone="danger"
          reason={{ label: "Reason (shown to the seller)", field: "reason", required: true, placeholder: "e.g. Repeated late dispatches — under review" }}
          success={`${name} suspended`}
          className={`btn btn-ghost${sm}`}
        >
          <Icon name="pause" />
          Suspend
        </ConfirmButton>
      ) : null}
      {status === "SUSPENDED" ? (
        <ConfirmButton
          url={url}
          body={{ action: "reactivate" }}
          confirm={`Reactivate ${name}?`}
          message="Portal access returns and the products taken down at suspension go live again."
          confirmLabel="Reactivate"
          tone="ok"
          success={`${name} reactivated`}
          className={`btn btn-dark${sm}`}
        >
          <Icon name="play" />
          Reactivate
        </ConfirmButton>
      ) : null}
    </div>
  );
}

export function CommissionEditor({ id, value, canEdit }: { id: string; value: number; canEdit: boolean }) {
  const [v, setV] = useState<number | null>(value);
  const [shown, setShown] = useState(value);
  const [err, setErr] = useState<string | undefined>();
  const { run, busy, lastError } = useAdminAction();
  // the saved value changed on the server (router.refresh) → reset the input
  if (shown !== value) {
    setShown(value);
    setV(value);
  }
  const fieldError = err ?? lastError?.fields.commissionPct;

  if (!canEdit) {
    return (
      <div>
        <div className="ag-bigpct">{value}%</div>
        <p className="am-muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Only an admin (owner) can change commission.
        </p>
      </div>
    );
  }
  return (
    <form
      className="ag-commission"
      onSubmit={(e) => {
        e.preventDefault();
        if (v == null || v < 0 || v > 60) return setErr("Enter 0–60%");
        setErr(undefined);
        run(`/api/v1/admin/sellers/${id}/commission`, { method: "PATCH", body: { commissionPct: v } }, { success: `Commission set to ${v}% — applies to new orders` });
      }}
    >
      <NumberField label="Commission" suffix="%" min={0} max={60} step={0.5} value={v} onChange={(x) => { setV(x); setErr(undefined); }} error={fieldError} />
      <button type="submit" className="btn btn-dark btn-sm" disabled={busy || v === value} aria-busy={busy || undefined} style={{ marginBottom: fieldError ? 22 : 2 }}>
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function Reveal({ value, masked }: { value: string; masked: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="ag-reveal">
      <span className="ag-mono">{show ? value : masked}</span>
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide account number" : "Show full account number"}>
        {show ? "Hide" : "Show"}
      </button>
    </span>
  );
}
