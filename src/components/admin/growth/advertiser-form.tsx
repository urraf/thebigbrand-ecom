"use client";
/**
 * Create / edit an advertiser in a modal → POST /api/v1/admin/advertisers · PATCH /api/v1/admin/advertisers/:id
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { FormError, Modal, SelectField, TextField, useAdminAction, useForm } from "@/components/admin/ui";

type Values = { companyName: string; contactName: string; email: string; phone: string; gstin: string; brandId: string };

export function AdvertiserFormButton({
  brands,
  initial,
  id,
  autoOpen,
  className = "btn btn-dark btn-sm",
  label,
}: {
  brands: Array<{ id: string; name: string }>;
  initial?: Partial<Values>;
  id?: string;
  autoOpen?: boolean;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const empty: Values = { companyName: "", contactName: "", email: "", phone: "", gstin: "", brandId: "", ...initial };
  const { values: v, set, errors, setErrors, setValues } = useForm<Values>(empty);
  const { run, busy, lastError } = useAdminAction();
  useEffect(() => {
    if (lastError) setErrors(lastError.fields);
  }, [lastError, setErrors]);

  async function submit() {
    const e: Record<string, string> = {};
    if (v.companyName.trim().length < 2) e.companyName = "Company name is required";
    if (v.contactName.trim().length < 2) e.contactName = "Contact name is required";
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "Enter a valid email";
    if (Object.keys(e).length) return setErrors(e);
    const body = { ...v, phone: v.phone || null, gstin: v.gstin || null, brandId: v.brandId || null };
    const res = await run<{ id: string }>(id ? `/api/v1/admin/advertisers/${id}` : "/api/v1/admin/advertisers", { method: id ? "PATCH" : "POST", body }, {
      success: id ? "Advertiser updated" : `${v.companyName.trim()} added`,
      redirect: id ? undefined : (d) => `/admin/advertisers/${(d as { id: string }).id}`,
    });
    if (res) {
      setOpen(false);
      if (!id) setValues(empty);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Icon name={id ? "sliders" : "plus"} />
        {label ?? (id ? "Edit details" : "New advertiser")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={id ? "Edit advertiser" : "New advertiser"}
        sub={id ? undefined : "For direct deals — brands that book online are added automatically."}
        locked={busy}
        onSubmit={submit}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy}>
              {busy ? "Saving…" : id ? "Save" : "Add advertiser"}
            </button>
          </>
        }
      >
        <div className="am-fgrid">
          <TextField wide label="Company" required value={v.companyName} onChange={(companyName) => set({ companyName })} error={errors.companyName} maxLength={120} placeholder="Nykaa Brands Pvt Ltd" autoComplete="organization" />
          <TextField label="Contact person" required value={v.contactName} onChange={(contactName) => set({ contactName })} error={errors.contactName} maxLength={80} autoComplete="name" />
          <TextField label="Email" type="email" required value={v.email} onChange={(email) => set({ email })} error={errors.email} maxLength={120} autoComplete="email" />
          <TextField label="Mobile" type="tel" inputMode="tel" value={v.phone} onChange={(phone) => set({ phone })} error={errors.phone} placeholder="98xxxxxxxx" maxLength={14} />
          <TextField label="GSTIN" value={v.gstin} onChange={(gstin) => set({ gstin: gstin.toUpperCase() })} error={errors.gstin} placeholder="07AAKCT4821M1Z5" maxLength={15} mono />
          <SelectField wide label="Brand" value={v.brandId} onChange={(brandId) => set({ brandId })} placeholder="No brand / agency" options={brands.map((b) => ({ value: b.id, label: b.name }))} error={errors.brandId} hint="Used on their creatives and to match self-serve bookings" />
        </div>
        <FormError message={lastError && !Object.keys(lastError.fields).length ? lastError.message : null} />
      </Modal>
    </>
  );
}
