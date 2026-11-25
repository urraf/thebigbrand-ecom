"use client";
/**
 * Address form — used by checkout step 1 and the account address book. Validates with the same zod schema
 * as the API (src/server/account/schemas.ts) and saves through POST / PATCH /api/v1/account/addresses.
 */
import { useId, useState } from "react";
import type { AddressView } from "@/server/checkout/types";
import { addressSchema, fieldErrors, INDIAN_STATES, type AddressInput } from "@/server/account/schemas";
import { pincodeCity } from "@/components/store/location";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { apiFieldErrors, capi, errMessage, omit } from "./api";

/** State from the first digits of a PIN code (only unambiguous postal circles; null otherwise). */
const PIN_STATE: [RegExp, (typeof INDIAN_STATES)[number]][] = [
  [/^11/, "Delhi"], [/^1[23]/, "Haryana"], [/^1[456]/, "Punjab"], [/^17/, "Himachal Pradesh"], [/^1[89]/, "Jammu & Kashmir"],
  [/^2[0-35789]/, "Uttar Pradesh"], [/^3[0-4]/, "Rajasthan"], [/^3[6-9]/, "Gujarat"], [/^403/, "Goa"], [/^4[0-4]/, "Maharashtra"],
  [/^4[5-8]/, "Madhya Pradesh"], [/^49/, "Chhattisgarh"], [/^50/, "Telangana"], [/^5[1-3]/, "Andhra Pradesh"], [/^5[6-9]/, "Karnataka"],
  [/^605/, "Puducherry"], [/^6[0-4]/, "Tamil Nadu"], [/^6[7-9]/, "Kerala"], [/^7[0-4]/, "West Bengal"], [/^7[5-7]/, "Odisha"],
  [/^78/, "Assam"], [/^8[0-5]/, "Bihar"],
];
const stateFor = (pin: string) => (pin.length === 6 ? (PIN_STATE.find(([re]) => re.test(pin))?.[1] ?? "") : "");

const LABELS = ["Home", "Work", "Other"];

type Props = {
  address?: AddressView | null;
  defaultName?: string | null;
  defaultPhone?: string | null;
  submitLabel?: string;
  onSaved: (a: AddressView) => void;
  onCancel?: () => void;
  /** first address of the account → it becomes the default anyway */
  forceDefault?: boolean;
};

export function AddressForm({ address, defaultName, defaultPhone, submitLabel = "Save address", onSaved, onCancel, forceDefault }: Props) {
  const uid = useId();
  const [v, setV] = useState<AddressInput>(() => ({
    label: address?.label ?? "Home",
    name: address?.name ?? defaultName ?? "",
    phone: address?.phone ?? defaultPhone ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    landmark: address?.landmark ?? "",
    city: address?.city ?? "",
    state: (address?.state ?? "") as AddressInput["state"],
    pincode: address?.pincode ?? "",
    isDefault: address?.isDefault ?? Boolean(forceDefault),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: keyof AddressInput, val: string | boolean) => {
    setV((prev) => {
      const next = { ...prev, [k]: val } as AddressInput;
      if (k === "pincode" && typeof val === "string" && /^[1-9]\d{5}$/.test(val)) {
        if (!prev.city) next.city = pincodeCity(val) ?? prev.city;
        if (!prev.state) next.state = (stateFor(val) || prev.state) as AddressInput["state"];
      }
      return next;
    });
    if (errors[k]) setErrors((f) => omit(f, k));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const parsed = addressSchema.safeParse(v);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      const first = Object.keys(errs)[0];
      const el = e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const body = { ...v, isDefault: v.isDefault || undefined };
      const saved = address
        ? await capi<AddressView>(`/api/v1/account/addresses/${encodeURIComponent(address.id)}`, { method: "PATCH", json: body })
        : await capi<AddressView>("/api/v1/account/addresses", { method: "POST", json: body });
      onSaved(saved);
    } catch (err) {
      const fe = apiFieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe);
      else setFormError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (name: keyof AddressInput, label: React.ReactNode, attrs: React.InputHTMLAttributes<HTMLInputElement> = {}, cls = "", pre?: string) => {
    const id = `${uid}-${name}`;
    const input = (
      <input
        id={id}
        name={name}
        value={String(v[name] ?? "")}
        onChange={(e) => set(name, name === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value)}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={`${id}-e`}
        {...attrs}
      />
    );
    return (
      <div className={cx("co-f", cls, errors[name] && "is-err")}>
        <label htmlFor={id}>{label}</label>
        {pre ? (
          <div className="co-pre">
            <span aria-hidden="true">{pre}</span>
            {input}
          </div>
        ) : (
          input
        )}
        <small className="co-err" id={`${id}-e`} aria-live="polite">
          {errors[name] ? (
            <>
              <Icon name="info" />
              {errors[name]}
            </>
          ) : null}
        </small>
      </div>
    );
  };

  return (
    <form className="co-form cm-addr-form" onSubmit={submit} noValidate>
      <div className="co-f co-f-wide">
        <span className="cm-lbl" id={`${uid}-lbl`}>
          Save as
        </span>
        <div className="cm-chips" role="radiogroup" aria-labelledby={`${uid}-lbl`}>
          {LABELS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={v.label === l} className={cx("chip", v.label === l && "on")} onClick={() => set("label", l)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {field("name", "Full name", { autoComplete: "name", required: true, maxLength: 80 })}
      {field("phone", "Mobile number", { type: "tel", inputMode: "numeric", autoComplete: "tel-national", required: true, maxLength: 14 }, "", "+91")}
      {field("line1", "Flat, house no., building, street", { autoComplete: "address-line1", required: true, maxLength: 160 }, "co-f-wide")}
      {field("line2", <>Area, colony, sector <em>(optional)</em></>, { autoComplete: "address-line2", maxLength: 160 })}
      {field("landmark", <>Landmark <em>(optional)</em></>, { maxLength: 80, placeholder: "e.g. near Apollo Pharmacy" })}
      {field("pincode", "Pincode", { inputMode: "numeric", autoComplete: "postal-code", required: true, maxLength: 6 })}
      {field("city", "Town / City", { autoComplete: "address-level2", required: true, maxLength: 60 })}
      <div className={cx("co-f", errors.state && "is-err")}>
        <label htmlFor={`${uid}-state`}>State</label>
        <select id={`${uid}-state`} name="state" value={v.state ?? ""} onChange={(e) => set("state", e.target.value)} autoComplete="address-level1" aria-invalid={errors.state ? true : undefined} aria-describedby={`${uid}-state-e`}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <small className="co-err" id={`${uid}-state-e`} aria-live="polite">
          {errors.state ? (
            <>
              <Icon name="info" />
              {errors.state}
            </>
          ) : null}
        </small>
      </div>
      {!forceDefault && !address?.isDefault ? (
        <label className="cm-check co-f-wide">
          <input type="checkbox" checked={Boolean(v.isDefault)} onChange={(e) => set("isDefault", e.target.checked)} />
          <span>Make this my default address</span>
        </label>
      ) : null}
      {formError ? (
        <p className="cm-alert is-err co-f-wide" role="alert">
          <Icon name="info" />
          <span>{formError}</span>
        </p>
      ) : null}
      <div className="co-sc-foot co-f-wide">
        <p className="co-foot-note">
          <Icon name="shield" />
          We only use your number for delivery updates.
        </p>
        <div className="cm-btns">
          {onCancel ? (
            <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="btn btn-cart btn-lg" disabled={busy} aria-busy={busy || undefined}>
            {busy ? (
              <>
                <span className="co-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                {submitLabel} <Icon name="arrow" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/** One saved address as a selectable / editable card. */
export function AddressCard({
  a,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onDefault,
  name = "co-addr",
}: {
  a: AddressView;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDefault?: () => void;
  name?: string;
}) {
  const body = (
    <>
      <span className="cm-ad-top">
        <b>{a.name}</b>
        {a.label ? <span className="cm-ad-lbl">{a.label}</span> : null}
        {a.isDefault ? <span className="cm-ad-def">Default</span> : null}
      </span>
      <span className="cm-ad-lines">
        {a.line1}
        {a.line2 ? `, ${a.line2}` : ""}
        {a.landmark ? `, ${a.landmark}` : ""}
        <br />
        {a.city}, {a.state} {a.pincode}
      </span>
      <span className="cm-ad-ph">
        <Icon name="phone" /> +91 {a.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}
      </span>
    </>
  );
  return (
    <div className={cx("cm-ad", selected && "is-on")}>
      {onSelect ? (
        <label className="cm-ad-main">
          <input type="radio" name={name} checked={Boolean(selected)} onChange={onSelect} />
          <span className="co-radio" aria-hidden="true" />
          <span className="cm-ad-b">{body}</span>
        </label>
      ) : (
        <div className="cm-ad-main">
          <span className="cm-ad-b">{body}</span>
        </div>
      )}
      {onEdit || onDelete || onDefault ? (
        <div className="cm-ad-acts">
          {onEdit ? (
            <button type="button" className="co-tb" onClick={onEdit}>
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" className="co-tb" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          {onDefault && !a.isDefault ? (
            <button type="button" className="co-tb" onClick={onDefault}>
              Set as default
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
