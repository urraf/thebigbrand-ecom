"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { formatINR } from "@/lib/money";
import { CheckField, ConfirmButton, Drawer, FormError, MoneyField, NumberField, SelectField, TextField, useAdminAction, useForm } from "@/components/admin/ui";

export type CouponRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  brandId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perUserLimit: number;
  isActive: boolean;
  isSponsored: boolean;
};

/** yyyy-mm-ddThh:mm in IST for <input type="datetime-local"> */
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v + ":00+05:30").toISOString() : null);

const form = (c?: CouponRow) => ({
  code: c?.code ?? "",
  title: c?.title ?? "",
  description: c?.description ?? "",
  type: c?.type ?? "FLAT",
  value: c ? c.value : (null as number | null),
  minOrder: c?.minOrder ?? (0 as number | null),
  maxDiscount: c?.maxDiscount ?? (null as number | null),
  brandId: c?.brandId ?? "",
  startsAt: toLocal(c?.startsAt ?? null),
  endsAt: toLocal(c?.endsAt ?? null),
  usageLimit: c?.usageLimit ?? (null as number | null),
  perUserLimit: c?.perUserLimit ?? (1 as number | null),
  isActive: c?.isActive ?? true,
  isSponsored: c?.isSponsored ?? false,
});

function summary(v: ReturnType<typeof form>) {
  const off = v.type === "PERCENT" ? `${v.value ?? 0}% off${v.maxDiscount ? ` (up to ${formatINR(v.maxDiscount)})` : ""}` : v.type === "FLAT" ? `${formatINR(v.value ?? 0)} off` : "Buy one, get one free";
  return `${off}${v.minOrder ? ` on orders of ${formatINR(v.minOrder)}+` : " on any order"}`;
}

export function CouponEditor({ coupon, brands, trigger }: { coupon?: CouponRow; brands: Array<{ id: string; name: string }>; trigger: "new" | "edit" }) {
  const [open, setOpen] = useState(false);
  const { values: v, set, errors, setErrors, setValues } = useForm(form(coupon));
  const { run, busy, lastError } = useAdminAction();
  const fe = { ...errors, ...(lastError?.fields ?? {}) };

  async function save() {
    const local: Record<string, string> = {};
    if (!/^[A-Z0-9]{3,20}$/.test(v.code)) local.code = "3–20 letters or numbers";
    if (v.title.trim().length < 2) local.title = "e.g. ₹100 off";
    if (v.type !== "BOGO" && !v.value) local.value = "Enter the discount";
    if (v.isSponsored && !v.brandId) local.brandId = "Sponsored coupons belong to a brand";
    if (Object.keys(local).length) return setErrors(local);
    const body = {
      code: v.code,
      title: v.title,
      description: v.description || null,
      type: v.type,
      value: v.type === "BOGO" ? 0 : v.value,
      minOrder: v.minOrder ?? 0,
      maxDiscount: v.type === "PERCENT" ? v.maxDiscount || null : null,
      brandId: v.brandId || null,
      startsAt: fromLocal(v.startsAt),
      endsAt: fromLocal(v.endsAt),
      usageLimit: v.usageLimit || null,
      perUserLimit: v.perUserLimit ?? 1,
      isActive: v.isActive,
      isSponsored: v.isSponsored,
    };
    const res = await run(coupon ? `/api/v1/admin/coupons/${coupon.id}` : "/api/v1/admin/coupons", { method: coupon ? "PATCH" : "POST", body }, { success: coupon ? "Coupon saved" : `Coupon ${v.code} created`, icon: "percent", quietError: true });
    if (res !== null) {
      setOpen(false);
      if (!coupon) setValues(form());
    }
  }

  return (
    <>
      {trigger === "new" ? (
        <button type="button" className="btn btn-dark btn-sm" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          New coupon
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setValues(form(coupon)); setOpen(true); }}>
          Edit
        </button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={coupon ? `Edit ${coupon.code}` : "New coupon"}
        sub="Discounts are recalculated on the server at checkout — these rules are enforced for every order."
        locked={busy}
        onSubmit={save}
        footer={
          <>
            {coupon ? (
              <ConfirmButton url={`/api/v1/admin/coupons/${coupon.id}`} method="DELETE" className="btn btn-ghost btn-sm" confirm={`Delete ${coupon.code}?`} message="Coupons that have been used can't be deleted — switch them off instead." confirmLabel="Delete" tone="danger" success="Coupon deleted">
                <Icon name="trash" />
                Delete
              </ConfirmButton>
            ) : null}
            <span className="am-sp" />
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy}>
              {busy ? "Saving…" : coupon ? "Save coupon" : "Create coupon"}
            </button>
          </>
        }
      >
        <div className="am-form">
          <div className="am-cpn-prev">
            <span className="am-cpn-code">{v.code || "CODE"}</span>
            <span>
              <b>{v.title || "Coupon title"}</b>
              <small>{summary(v)}</small>
            </span>
            {v.isSponsored ? <span className="am-tag am-tag-pz">H9 coupon wall</span> : null}
          </div>
          <FormError message={lastError && !Object.keys(lastError.fields).length ? lastError.message : null} />
          <div className="am-fgrid">
            <TextField label="Code" required value={v.code} onChange={(code) => set({ code: code.toUpperCase().replace(/[^A-Z0-9]/g, "") })} maxLength={20} error={fe.code} placeholder="WELCOME10" mono />
            <TextField label="Title (shown to shoppers)" required value={v.title} onChange={(title) => set({ title })} maxLength={40} error={fe.title} placeholder="₹100 off" />
            <TextField wide label="Description" value={v.description} onChange={(description) => set({ description })} maxLength={80} placeholder="on orders above ₹999" />
            <SelectField
              label="Discount type"
              value={v.type}
              onChange={(type) => set({ type })}
              options={[
                { value: "FLAT", label: "Flat ₹ off" },
                { value: "PERCENT", label: "Percent off" },
                { value: "BOGO", label: "Buy one get one" },
              ]}
            />
            {v.type === "PERCENT" ? (
              <NumberField label="Percent off" required value={v.value} onChange={(value) => set({ value })} min={1} max={90} suffix="%" error={fe.value} />
            ) : v.type === "FLAT" ? (
              <MoneyField label="Rupees off" required value={v.value} onChange={(value) => set({ value })} error={fe.value} />
            ) : (
              <div />
            )}
            <MoneyField label="Minimum order" value={v.minOrder} onChange={(minOrder) => set({ minOrder })} error={fe.minOrder} hint="0 = any order" />
            {v.type === "PERCENT" ? <MoneyField label="Maximum discount" value={v.maxDiscount} onChange={(maxDiscount) => set({ maxDiscount })} error={fe.maxDiscount} hint="Cap for percent coupons" /> : <div />}
            <SelectField label="Brand" value={v.brandId} onChange={(brandId) => set({ brandId })} options={[{ value: "", label: "All products (store-wide)" }, ...brands.map((b) => ({ value: b.id, label: `${b.name} items only` }))]} error={fe.brandId} />
            <CheckField label="Sponsored brand coupon" hint="Shown on the homepage coupon wall (H9), billed per clip" checked={v.isSponsored} onChange={(isSponsored) => set({ isSponsored })} className="am-check-pad" />
            <TextField label="Starts (IST)" type="datetime-local" value={v.startsAt} onChange={(startsAt) => set({ startsAt })} error={fe.startsAt} hint="Empty = immediately" />
            <TextField label="Ends (IST)" type="datetime-local" value={v.endsAt} onChange={(endsAt) => set({ endsAt })} error={fe.endsAt} hint="Empty = no end date" />
            <NumberField label="Total uses allowed" value={v.usageLimit} onChange={(usageLimit) => set({ usageLimit })} min={1} placeholder="Unlimited" error={fe.usageLimit} />
            <NumberField label="Uses per customer" value={v.perUserLimit} onChange={(perUserLimit) => set({ perUserLimit })} min={1} max={100} error={fe.perUserLimit} />
            <CheckField label="Active" hint="Switch off to stop it working everywhere" checked={v.isActive} onChange={(isActive) => set({ isActive })} />
          </div>
        </div>
      </Drawer>
    </>
  );
}
