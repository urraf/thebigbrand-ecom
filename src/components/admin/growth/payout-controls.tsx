"use client";
/**
 * Payout & ledger islands (superadmin actions — buttons are disabled for staff, and the API enforces it):
 *  - CreatePayoutButton   → POST  /api/v1/admin/payouts { sellerId, amount ≤ available, note, periodStart/End }
 *  - PayoutStatusActions  → PATCH /api/v1/admin/payouts/:id { status: PROCESSING | PAID (+ UTR) | FAILED }
 *  - AdjustmentButton     → POST  /api/v1/admin/payouts/adjustments { sellerId, amount ±, reason }
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ActionButton, ConfirmButton, FormError, Modal, MoneyField, SelectField, TextAreaField, TextField, useAdminAction, useForm } from "@/components/admin/ui";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const NOT_ALLOWED = "Only an admin (owner) can move money";

export type PayoutSeller = { id: string; name: string; available: number; balance: number; reserved: number; bank: string | null; hasBank: boolean };

export function CreatePayoutButton({ seller, canEdit, className = "btn btn-dark btn-sm" }: { seller: PayoutSeller; canEdit: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const { values: v, set, errors, setErrors } = useForm<{ amount: number | null; note: string; from: string; to: string }>({ amount: seller.available, note: "", from: "", to: "" });
  const { run, busy, lastError } = useAdminAction();
  useEffect(() => {
    if (lastError) setErrors(lastError.fields);
  }, [lastError, setErrors]);
  const disabled = !canEdit || seller.available <= 0 || !seller.hasBank;
  const why = !canEdit ? NOT_ALLOWED : !seller.hasBank ? "No bank account / UPI on file" : seller.available <= 0 ? "Nothing available to pay out" : undefined;

  async function submit() {
    if (!v.amount || v.amount < 1) return setErrors({ amount: "Enter an amount" });
    if (v.amount > seller.available) return setErrors({ amount: `Max ${inr(seller.available)}` });
    const ok = await run(
      "/api/v1/admin/payouts",
      {
        method: "POST",
        body: {
          sellerId: seller.id,
          amount: Math.round(v.amount),
          note: v.note.trim() || undefined,
          periodStart: v.from ? `${v.from}T00:00:00+05:30` : undefined,
          periodEnd: v.to ? `${v.to}T23:59:59+05:30` : undefined,
        },
      },
      { success: `Payout of ${inr(v.amount)} to ${seller.name} created — mark it processing when the transfer starts`, icon: "card" },
    );
    if (ok) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        title={why}
        aria-label={`Create payout for ${seller.name}`}
        onClick={() => {
          set({ amount: seller.available });
          setOpen(true);
        }}
      >
        <Icon name="card" />
        Pay out
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Pay out to ${seller.name}`}
        sub={seller.bank ? `To ${seller.bank}` : undefined}
        size="sm"
        locked={busy}
        onSubmit={submit}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy}>
              {busy ? "Creating…" : "Create payout"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div className="ag-sum">
            <div>
              <span>Ledger balance</span>
              <b>{inr(seller.balance)}</b>
            </div>
            <div>
              <span>Already in open payouts</span>
              <b>− {inr(seller.reserved)}</b>
            </div>
            <div className="tot">
              <span>Available</span>
              <b>{inr(seller.available)}</b>
            </div>
          </div>
          <MoneyField label="Amount" required value={v.amount} onChange={(amount) => set({ amount })} max={seller.available} error={errors.amount} hint="Whole rupees" />
          <div className="am-fgrid">
            <TextField label="Period from" type="date" value={v.from} onChange={(from) => set({ from })} />
            <TextField label="to" type="date" value={v.to} onChange={(to) => set({ to })} error={errors.periodEnd} />
          </div>
          <TextAreaField label="Note" rows={2} value={v.note} onChange={(note) => set({ note })} maxLength={300} placeholder="e.g. Weekly settlement · 18–24 Nov" />
          <p className="am-muted" style={{ fontSize: 12.5 }}>The ledger is debited only when you mark the payout Paid with the bank UTR.</p>
          <FormError message={lastError && !Object.keys(lastError.fields).length ? lastError.message : null} />
        </div>
      </Modal>
    </>
  );
}

export function PayoutStatusActions({ payout, canEdit }: { payout: { id: string; status: string; amount: number; sellerName: string }; canEdit: boolean }) {
  const url = `/api/v1/admin/payouts/${payout.id}`;
  const [open, setOpen] = useState(false);
  const [utr, setUtr] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const { run, busy, lastError } = useAdminAction();
  const utrError = err ?? lastError?.fields.reference;

  if (payout.status === "PAID" || payout.status === "FAILED") return null;
  if (!canEdit) return <span className="am-muted" style={{ fontSize: 12 }} title={NOT_ALLOWED}>Admin only</span>;

  async function markPaid() {
    const ref = utr.trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,40}$/.test(ref)) return setErr("Enter the bank UTR / reference (6–40 letters or digits)");
    const ok = await run(url, { method: "PATCH", body: { status: "PAID", reference: ref } }, { success: `${inr(payout.amount)} marked paid to ${payout.sellerName} · ledger debited`, icon: "check" });
    if (ok) {
      setOpen(false);
      setUtr("");
    }
  }

  return (
    <div className="ag-actions">
      {payout.status === "PENDING" ? (
        <ActionButton url={url} method="PATCH" body={{ status: "PROCESSING" }} success="Marked processing" icon="clock" className="btn btn-ghost btn-sm">
          Processing
        </ActionButton>
      ) : null}
      {payout.status === "PROCESSING" ? (
        <button type="button" className="btn btn-ok btn-sm" onClick={() => setOpen(true)}>
          <Icon name="check" />
          Mark paid
        </button>
      ) : null}
      <ConfirmButton
        url={url}
        method="PATCH"
        body={{ status: "FAILED" }}
        confirm="Mark this payout failed?"
        message="The reserved amount goes back to the seller's available balance. Nothing is written to the ledger."
        confirmLabel="Mark failed"
        tone="danger"
        reason={{ label: "What happened", field: "note", required: true, placeholder: "e.g. Bank rejected — IFSC mismatch" }}
        success="Payout marked failed"
        className="btn btn-ghost btn-sm"
      >
        Failed
      </ConfirmButton>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Mark ${inr(payout.amount)} paid`}
        sub={`To ${payout.sellerName}`}
        size="sm"
        locked={busy}
        onSubmit={markPaid}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-ok" disabled={busy}>
              {busy ? "Saving…" : "Mark paid"}
            </button>
          </>
        }
      >
        <TextField
          label="Bank UTR / reference"
          required
          value={utr}
          onChange={(x) => {
            setUtr(x.toUpperCase());
            setErr(undefined);
          }}
          error={utrError}
          placeholder="UTR663642494"
          maxLength={40}
          mono
          hint="From the NEFT / IMPS / UPI confirmation. A PAYOUT debit is written to the seller ledger."
        />
      </Modal>
    </div>
  );
}

export function AdjustmentButton({
  sellers,
  sellerId,
  canEdit,
  className = "btn btn-ghost btn-sm",
}: {
  sellers: Array<{ id: string; name: string }>;
  sellerId?: string;
  canEdit: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { values: v, set, errors, setErrors } = useForm<{ sellerId: string; dir: "credit" | "debit"; amount: number | null; reason: string }>({
    sellerId: sellerId ?? "",
    dir: "credit",
    amount: null,
    reason: "",
  });
  const { run, busy, lastError } = useAdminAction();
  useEffect(() => {
    if (lastError) setErrors(lastError.fields);
  }, [lastError, setErrors]);

  async function submit() {
    const e: Record<string, string> = {};
    if (!v.sellerId) e.sellerId = "Choose a seller";
    if (!v.amount || v.amount < 1) e.amount = "Enter an amount";
    if (v.reason.trim().length < 5) e.reason = "Explain the adjustment (at least 5 characters)";
    if (Object.keys(e).length) return setErrors(e);
    const amount = Math.round(v.amount!) * (v.dir === "debit" ? -1 : 1);
    const ok = await run(
      "/api/v1/admin/payouts/adjustments",
      { method: "POST", body: { sellerId: v.sellerId, amount, reason: v.reason.trim() } },
      { success: `${v.dir === "credit" ? "Credit" : "Debit"} of ${inr(Math.abs(amount))} posted to the ledger` },
    );
    if (ok) {
      setOpen(false);
      set({ amount: null, reason: "" });
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={!canEdit} title={canEdit ? undefined : NOT_ALLOWED} onClick={() => setOpen(true)}>
        <Icon name="sliders" />
        Adjustment
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Manual ledger adjustment"
        sub="Corrections, goodwill credits, penalties. Audited with your name."
        size="sm"
        locked={busy}
        onSubmit={submit}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy}>
              {busy ? "Posting…" : "Post adjustment"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          {sellerId ? null : (
            <SelectField label="Seller" required value={v.sellerId} onChange={(id) => set({ sellerId: id })} placeholder="Choose a seller…" options={sellers.map((s) => ({ value: s.id, label: s.name }))} error={errors.sellerId} />
          )}
          <div className="am-segctl" role="group" aria-label="Direction" style={{ justifySelf: "start" }}>
            <button type="button" aria-pressed={v.dir === "credit"} onClick={() => set({ dir: "credit" })}>
              <Icon name="plus" />
              Credit seller
            </button>
            <button type="button" aria-pressed={v.dir === "debit"} onClick={() => set({ dir: "debit" })}>
              <Icon name="minus" />
              Debit seller
            </button>
          </div>
          <MoneyField label="Amount" required value={v.amount} onChange={(amount) => set({ amount })} error={errors.amount} />
          <TextAreaField label="Reason" required rows={3} value={v.reason} onChange={(reason) => set({ reason })} maxLength={300} error={errors.reason} placeholder="e.g. Courier lost order TBB2611201022 — reimbursing the seller" />
          <FormError message={lastError && !Object.keys(lastError.fields).length ? lastError.message : null} />
        </div>
      </Modal>
    </>
  );
}
