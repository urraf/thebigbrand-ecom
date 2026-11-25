"use client";
/**
 * Business profile editor → PATCH /api/v1/seller/profile. Only changed fields are sent. Bank changes need the
 * account password (verified + audited server-side). Legal identity is read-only after approval.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, ApiFailure, errorText } from "./api";
import { uploadImage } from "./upload";
import { INDIAN_STATES, IFSC_RE, PINCODE_RE, UPI_RE, normKyc } from "./kyc";
import { initials } from "./format";

export type ProfileView = {
  displayName: string;
  description: string | null;
  logoUrl: string | null;
  categories: string[];
  contactName: string;
  email: string;
  phone: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  bankAccountName: string | null;
  bankAccountNumberMasked: string;
  bankIfsc: string | null;
  upiId: string | null;
};

type Props = { profile: ProfileView; categories: { slug: string; name: string }[] };

export function ProfileForm({ profile, categories }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const [f, setF] = useState({
    displayName: profile.displayName,
    description: profile.description ?? "",
    logoUrl: profile.logoUrl,
    categories: profile.categories,
    contactName: profile.contactName,
    email: profile.email,
    phone: profile.phone,
    addressLine: profile.addressLine ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    pincode: profile.pincode ?? "",
    bankAccountName: profile.bankAccountName ?? "",
    bankAccountNumber: "",
    bankIfsc: profile.bankIfsc ?? "",
    upiId: profile.upiId ?? "",
    currentPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const bankDirty =
    f.bankAccountName !== (profile.bankAccountName ?? "") ||
    f.bankAccountNumber !== "" ||
    normKyc(f.bankIfsc) !== (profile.bankIfsc ?? "") ||
    f.upiId.trim() !== (profile.upiId ?? "");

  const err = (k: string) => (errors[k] ? <small className="sl-err">{errors[k]}</small> : null);
  const inv = (k: string) => ({ "aria-invalid": !!errors[k] || undefined });

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const m = await uploadImage(file, `${f.displayName} logo`);
      set("logoUrl", m.url);
      toast("Logo uploaded — save to apply", { icon: "check" });
    } catch (e) {
      toast(errorText(e), { icon: "info" });
    } finally {
      setUploading(false);
    }
  }

  function diff() {
    const body: Record<string, unknown> = {};
    const plain = ["displayName", "contactName", "email", "phone", "addressLine", "city", "state", "pincode"] as const;
    for (const k of plain) if (f[k].trim() !== ((profile[k] as string | null) ?? "")) body[k] = f[k].trim();
    if (f.description.trim() !== (profile.description ?? "")) body.description = f.description.trim() || null;
    if (f.logoUrl !== profile.logoUrl) body.logoUrl = f.logoUrl;
    if (JSON.stringify([...f.categories].sort()) !== JSON.stringify([...profile.categories].sort())) body.categories = f.categories;
    if (bankDirty) {
      if (f.bankAccountName !== (profile.bankAccountName ?? "")) body.bankAccountName = f.bankAccountName.trim();
      if (f.bankAccountNumber) body.bankAccountNumber = f.bankAccountNumber;
      if (normKyc(f.bankIfsc) !== (profile.bankIfsc ?? "")) body.bankIfsc = f.bankIfsc;
      if (f.upiId.trim() !== (profile.upiId ?? "")) body.upiId = f.upiId.trim() || null;
      body.currentPassword = f.currentPassword;
    }
    return body;
  }

  function validate() {
    const e: Record<string, string> = {};
    if (f.displayName.trim().length < 2) e.displayName = "Enter your store name";
    if (f.contactName.trim().length < 2) e.contactName = "Enter a contact name";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email";
    if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, "").slice(-10))) e.phone = "Enter a 10-digit mobile number";
    if (f.addressLine.trim().length < 5) e.addressLine = "Enter the pickup address";
    if (f.city.trim().length < 2) e.city = "Enter the city";
    if (!f.state) e.state = "Choose a state";
    if (!PINCODE_RE.test(f.pincode.trim())) e.pincode = "Enter a 6-digit PIN code";
    if (!f.categories.length) e.categories = "Pick at least one category";
    if (bankDirty) {
      if (f.bankAccountName.trim().length < 2) e.bankAccountName = "Enter the account holder name";
      if (f.bankAccountNumber && !/^\d{9,18}$/.test(f.bankAccountNumber)) e.bankAccountNumber = "Account number has 9–18 digits";
      if (!IFSC_RE.test(normKyc(f.bankIfsc))) e.bankIfsc = "IFSC looks like HDFC0001234";
      if (f.upiId.trim() && !UPI_RE.test(f.upiId.trim())) e.upiId = "UPI ID looks like name@bank";
      if (!f.currentPassword) e.currentPassword = "Enter your password to change bank details";
    }
    return e;
  }

  async function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast("Please fix the highlighted fields", { icon: "info" });
      return;
    }
    const body = diff();
    if (!Object.keys(body).length) {
      toast("Nothing to save", { icon: "info" });
      return;
    }
    setSaving(true);
    try {
      const out = await api<{ updated: boolean; bankChanged?: boolean }>("/api/v1/seller/profile", { method: "PATCH", body });
      toast(out.bankChanged ? "Saved — bank details updated. Payouts go to the new account." : "Profile saved", { icon: "check" });
      setF((p) => ({ ...p, bankAccountNumber: "", currentPassword: "" }));
      start(() => router.refresh());
    } catch (ex) {
      if (ex instanceof ApiFailure && Object.keys(ex.fields).length) setErrors(Object.fromEntries(Object.entries(ex.fields).map(([k, v]) => [k, v?.[0] ?? ""])));
      toast(errorText(ex), { icon: "info" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="sl-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="sl-card sl-form-sec" aria-labelledby="pf-store">
        <h3 id="pf-store">
          <Icon name="store" /> Store details
        </h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span className="sl-me-av" style={{ width: 72, height: 72, borderRadius: 16, fontSize: 22, color: "#fff", border: "1px solid var(--line)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.logoUrl ? <img src={f.logoUrl} alt="Store logo" /> : initials(f.displayName)}
          </span>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="sl-actions">
              <label className="btn btn-ghost btn-sm" style={{ position: "relative", cursor: "pointer" }} aria-busy={uploading}>
                <Icon name="upload" /> {uploading ? "Uploading…" : f.logoUrl ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </label>
              {f.logoUrl ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("logoUrl", null)}>
                  Remove
                </button>
              ) : null}
            </div>
            <small className="sl-muted" style={{ fontSize: 12 }}>
              Square PNG or JPG, at least 256 × 256 px, up to 5 MB.
            </small>
          </div>
        </div>
        <div className="sl-fgrid">
          <label className="sl-field">
            <span>Store name shoppers see</span>
            <input value={f.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={60} {...inv("displayName")} />
            {err("displayName") ?? <small>Shown as “Sold by {f.displayName || "…"}” on product pages.</small>}
          </label>
          <div />
          <label className="sl-field sl-full">
            <span>
              About your store <em>(optional)</em>
            </span>
            <textarea value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={600} rows={3} placeholder="e.g. Authorised distributor of Beardo and Bella Vita since 2018." />
          </label>
          <fieldset className="sl-field sl-full" style={{ border: 0 }}>
            <legend>Categories you sell in</legend>
            <div className="sl-checks" style={{ marginTop: 6 }}>
              {categories.map((c) => (
                <label key={c.slug} className="sl-check">
                  <input
                    type="checkbox"
                    checked={f.categories.includes(c.slug)}
                    onChange={(e) => set("categories", e.target.checked ? [...f.categories, c.slug] : f.categories.filter((x) => x !== c.slug))}
                  />
                  <Icon name="check" />
                  {c.name}
                </label>
              ))}
            </div>
            {err("categories")}
          </fieldset>
        </div>
      </section>

      <section className="sl-card sl-form-sec" aria-labelledby="pf-contact">
        <h3 id="pf-contact">
          <Icon name="user" /> Contact &amp; pickup address
        </h3>
        <div className="sl-fgrid sl-fgrid-3">
          <label className="sl-field">
            <span>Contact person</span>
            <input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} autoComplete="name" {...inv("contactName")} />
            {err("contactName")}
          </label>
          <label className="sl-field">
            <span>Business email</span>
            <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" {...inv("email")} />
            {err("email") ?? <small>Order alerts and payout advice go here.</small>}
          </label>
          <label className="sl-field">
            <span>Mobile</span>
            <input inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d+ ]/g, ""))} autoComplete="tel" {...inv("phone")} />
            {err("phone")}
          </label>
        </div>
        <div className="sl-fgrid">
          <label className="sl-field sl-full">
            <span>Pickup / warehouse address</span>
            <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} autoComplete="street-address" {...inv("addressLine")} />
            {err("addressLine") ?? <small>Couriers collect from here. Printed on packing slips.</small>}
          </label>
        </div>
        <div className="sl-fgrid sl-fgrid-3">
          <label className="sl-field">
            <span>City</span>
            <input value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" {...inv("city")} />
            {err("city")}
          </label>
          <label className="sl-field">
            <span>State</span>
            <select value={f.state} onChange={(e) => set("state", e.target.value)} {...inv("state")}>
              <option value="">Choose…</option>
              {INDIAN_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {err("state")}
          </label>
          <label className="sl-field">
            <span>PIN code</span>
            <input inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} autoComplete="postal-code" {...inv("pincode")} />
            {err("pincode")}
          </label>
        </div>
      </section>

      <section className="sl-card sl-form-sec" aria-labelledby="pf-bank">
        <h3 id="pf-bank">
          <Icon name="card" /> Bank account for payouts
        </h3>
        <p>For your security, changing bank details needs your password, and every change is recorded in the audit log.</p>
        <div className="sl-fgrid">
          <label className="sl-field">
            <span>Account holder name</span>
            <input value={f.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} {...inv("bankAccountName")} />
            {err("bankAccountName")}
          </label>
          <label className="sl-field">
            <span>Account number</span>
            <input
              inputMode="numeric"
              value={f.bankAccountNumber}
              onChange={(e) => set("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
              placeholder={profile.bankAccountNumberMasked ? `Current: ${profile.bankAccountNumberMasked}` : "Account number"}
              autoComplete="off"
              {...inv("bankAccountNumber")}
            />
            {err("bankAccountNumber") ?? <small>Leave blank to keep the current account.</small>}
          </label>
          <label className="sl-field">
            <span>IFSC</span>
            <input value={f.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} maxLength={11} {...inv("bankIfsc")} />
            {err("bankIfsc")}
          </label>
          <label className="sl-field">
            <span>
              UPI ID <em>(optional)</em>
            </span>
            <input value={f.upiId} onChange={(e) => set("upiId", e.target.value)} placeholder="name@bank" {...inv("upiId")} />
            {err("upiId")}
          </label>
          {bankDirty ? (
            <label className="sl-field sl-full" style={{ maxWidth: 420 }}>
              <span>Confirm with your password</span>
              <input type="password" value={f.currentPassword} onChange={(e) => set("currentPassword", e.target.value)} autoComplete="current-password" {...inv("currentPassword")} />
              {err("currentPassword") ?? <small>Required to change bank details.</small>}
            </label>
          ) : null}
        </div>
      </section>

      <div className="sl-sticky-act">
        <small>{bankDirty ? "Bank details changed — password required" : "Changes apply immediately"}</small>
        <span className="sl-spacer" />
        <button type="submit" className="btn btn-cart" disabled={saving || uploading}>
          <Icon name="check" /> {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
