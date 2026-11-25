"use client";
/** Settings sections — each saves its own Setting row via PATCH /api/v1/admin/settings. */
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { formatINR } from "@/lib/money";
import { CheckField, FormError, MoneyField, NumberField, TagsField, TextAreaField, TextField, useAdminAction, useForm } from "@/components/admin/ui";

type Store = { name: string; legalName: string; gstin: string; supportEmail: string; supportPhone: string; address: string; grievanceName: string; grievanceEmail: string; invoicePrefix: string };
type Shipping = { shippingFee: number; freeShippingMin: number; codEnabled: boolean; codFee: number; codMaxOrder: number; partner: string; dispatchDays: number };

function SaveBar({ busy, dirty, saved }: { busy: boolean; dirty: boolean; saved?: boolean }) {
  return (
    <div className="am-factions am-set-act">
      <span className="am-sp am-set-state">{dirty ? "Unsaved changes" : saved ? <><Icon name="check" /> Saved</> : null}</span>
      <button type="submit" className="btn btn-dark btn-sm" disabled={busy || !dirty} aria-busy={busy || undefined}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

export function StoreForm({ initial }: { initial: Store }) {
  const { values: v, set } = useForm(initial);
  const [base, setBase] = useState(initial);
  const { run, busy, lastError } = useAdminAction();
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const fe = lastError?.fields ?? {};
  return (
    <form
      className="am-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run("/api/v1/admin/settings", { method: "PATCH", body: { store: v } }, { success: "Store details saved", quietError: true });
        if (ok !== null) setBase(v);
      }}
      noValidate
    >
      <FormError message={fe.store ?? (lastError && !Object.keys(fe).length ? lastError.message : null)} />
      <div className="am-fgrid">
        <TextField label="Store name" value={v.name} onChange={(name) => set({ name })} maxLength={80} />
        <TextField label="Legal entity" value={v.legalName} onChange={(legalName) => set({ legalName })} maxLength={120} />
        <TextField label="GSTIN" value={v.gstin} onChange={(gstin) => set({ gstin: gstin.toUpperCase() })} maxLength={15} mono hint="Printed on every invoice" />
        <TextField label="Invoice prefix" value={v.invoicePrefix} onChange={(invoicePrefix) => set({ invoicePrefix: invoicePrefix.toUpperCase() })} maxLength={10} mono />
        <TextField label="Support email" type="email" value={v.supportEmail} onChange={(supportEmail) => set({ supportEmail })} />
        <TextField label="Support phone" type="tel" value={v.supportPhone} onChange={(supportPhone) => set({ supportPhone })} maxLength={20} />
      </div>
      <TextAreaField label="Registered / warehouse address" value={v.address} onChange={(address) => set({ address })} rows={2} maxLength={240} hint="Shown on invoices and on the Contact, Terms and Privacy pages" />
      <div className="am-fgrid">
        <TextField label="Grievance officer" value={v.grievanceName} onChange={(grievanceName) => set({ grievanceName })} maxLength={80} hint="Required by the Consumer Protection (E-Commerce) Rules — shown on Contact" />
        <TextField label="Grievance officer email" type="email" value={v.grievanceEmail} onChange={(grievanceEmail) => set({ grievanceEmail })} hint="Leave empty to use the support email" />
      </div>
      <SaveBar busy={busy} dirty={dirty} />
    </form>
  );
}

export function ShippingForm({ initial }: { initial: Shipping }) {
  const { values: v, set } = useForm(initial);
  const [base, setBase] = useState(initial);
  const { run, busy } = useAdminAction();
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  return (
    <form
      className="am-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run("/api/v1/admin/settings", { method: "PATCH", body: { shipping: v } }, { success: "Shipping & COD rules saved — checkout uses them now" });
        if (ok !== null) setBase(v);
      }}
      noValidate
    >
      <div className="am-fgrid">
        <MoneyField label="Shipping fee" value={v.shippingFee} onChange={(n) => set({ shippingFee: n ?? 0 })} hint="Charged below the free-shipping threshold" />
        <MoneyField label="Free shipping from" value={v.freeShippingMin} onChange={(n) => set({ freeShippingMin: n ?? 0 })} hint={v.freeShippingMin ? `Orders of ${formatINR(v.freeShippingMin)}+ ship free` : "Every order ships free"} />
        <TextField label="Shipping partner" value={v.partner} onChange={(partner) => set({ partner })} maxLength={60} />
        <NumberField label="Dispatch within" value={v.dispatchDays} onChange={(n) => set({ dispatchDays: n ?? 0 })} min={0} max={14} suffix="days" />
      </div>
      <div className="am-togrow">
        <span>
          <b>Cash on delivery</b>
          <small>Let shoppers pay when the order arrives</small>
        </span>
        <CheckField label={v.codEnabled ? "Enabled" : "Disabled"} checked={v.codEnabled} onChange={(codEnabled) => set({ codEnabled })} />
      </div>
      {v.codEnabled ? (
        <div className="am-fgrid">
          <MoneyField label="COD fee" value={v.codFee} onChange={(n) => set({ codFee: n ?? 0 })} hint="0 = free COD" />
          <MoneyField label="COD limit per order" value={v.codMaxOrder} onChange={(n) => set({ codMaxOrder: n ?? 0 })} hint="0 = no limit" />
        </div>
      ) : null}
      <SaveBar busy={busy} dirty={dirty} />
    </form>
  );
}

export function TrendingForm({ initial }: { initial: string[] }) {
  const [list, setList] = useState(initial);
  const [base, setBase] = useState(initial);
  const { run, busy } = useAdminAction();
  const dirty = JSON.stringify(list) !== JSON.stringify(base);
  return (
    <form
      className="am-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run("/api/v1/admin/settings", { method: "PATCH", body: { trending: list } }, { success: "Trending searches updated" });
        if (ok !== null) setBase(list);
      }}
    >
      <TagsField label="Shown in the search box before shoppers type" value={list} onChange={setList} max={12} lowercase placeholder="Type a search and press Enter" hint="Up to 12 · drag order = typing order" />
      <SaveBar busy={busy} dirty={dirty} />
    </form>
  );
}
