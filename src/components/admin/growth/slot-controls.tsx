"use client";
/**
 * Ads Manager client islands:
 *  - RateEditor: click the rate to edit it inline → PATCH /api/v1/admin/ads/:code { rate }
 *  - SlotSettingsForm: rate, positions, potential, self-serve flag, description → PATCH /api/v1/admin/ads/:code
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { CheckField, FormError, NumberField, TextAreaField, useAdminAction, useForm } from "@/components/admin/ui";

const UNIT: Record<string, string> = { DAY: "/day", WEEK: "/week", MONTH: "/month", CPM: " CPM", CPC: "/click", CLIP: "/clip", BOX: "/box" };

function fmtRate(model: string, rate: number) {
  const r = Number.isInteger(rate) ? rate.toLocaleString("en-IN") : rate.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `₹${r}${UNIT[model] ?? ""}`;
}

export function RateEditor({ code, name, model, rate }: { code: string; name: string; model: string; rate: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(rate));
  const [shown, setShown] = useState(rate);
  const { run, busy } = useAdminAction();

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    if (n === shown) {
      setEditing(false);
      return;
    }
    const res = await run<{ rate: number; rateLabel: string }>(
      `/api/v1/admin/ads/${code}`,
      { method: "PATCH", body: { rate: n } },
      { success: (d) => `${code} rate set to ${(d as { rateLabel: string }).rateLabel} — applies to new bookings`, icon: "tag" },
    );
    if (res) {
      setShown(res.rate);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <span className="ag-rate">
        <button
          type="button"
          className="ag-rate-v"
          onClick={() => {
            setValue(String(shown));
            setEditing(true);
          }}
          aria-label={`Edit rate for ${code} ${name}: ${fmtRate(model, shown)}`}
          title="Edit rate"
        >
          {fmtRate(model, shown)}
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
          </svg>
        </button>
      </span>
    );
  }
  return (
    <span className="ag-rate">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <span className="ag-rate-in">
          <i aria-hidden="true">₹</i>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step={model === "CLIP" || model === "BOX" ? 0.01 : 1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            aria-label={`New rate for ${code} in rupees ${UNIT[model] ?? ""}`}
            autoFocus
            disabled={busy}
          />
        </span>
        <small>{UNIT[model]?.trim()}</small>
        <button type="submit" className="ib-sm" aria-label="Save rate" disabled={busy || !(Number(value) > 0)}>
          <Icon name="check" />
        </button>
        <button type="button" className="ib-sm" aria-label="Cancel" onClick={() => setEditing(false)} disabled={busy}>
          <Icon name="close" />
        </button>
      </form>
    </span>
  );
}

type SlotSettings = { rate: number | null; positions: number | null; potentialMonthly: number | null; bookable: boolean; description: string };

export function SlotSettingsForm({
  code,
  model,
  initial,
}: {
  code: string;
  model: string;
  initial: { rate: number; positions: number; potentialMonthly: number; bookable: boolean; description: string | null };
}) {
  const { values, set, errors, setErrors } = useForm<SlotSettings>({ ...initial, description: initial.description ?? "" });
  const { run, busy, lastError } = useAdminAction();
  useEffect(() => {
    if (lastError) setErrors(lastError.fields);
  }, [lastError, setErrors]);
  const dirty =
    values.rate !== initial.rate ||
    values.positions !== initial.positions ||
    values.potentialMonthly !== initial.potentialMonthly ||
    values.bookable !== initial.bookable ||
    values.description !== (initial.description ?? "");

  async function submit() {
    const errs: Record<string, string> = {};
    if (!(Number(values.rate) > 0)) errs.rate = "Enter a rate above ₹0";
    if (!values.positions || values.positions < 1) errs.positions = "At least 1";
    if (Object.keys(errs).length) return setErrors(errs);
    await run(
      `/api/v1/admin/ads/${code}`,
      {
        method: "PATCH",
        body: {
          rate: values.rate,
          positions: values.positions,
          potentialMonthly: values.potentialMonthly ?? 0,
          bookable: values.bookable,
          description: values.description.trim() || null,
        },
      },
      { success: `${code} settings saved` },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
      style={{ display: "grid", gap: 14 }}
    >
      <div className="am-fgrid">
        <NumberField
          label={`Rate (${UNIT[model]?.trim() ?? model})`}
          prefix="₹"
          step={model === "CLIP" || model === "BOX" ? 0.01 : 1}
          min={0}
          value={values.rate}
          onChange={(rate) => set({ rate })}
          error={errors.rate}
          hint="New bookings only — running campaigns keep their rate"
          required
        />
        <NumberField label="Positions" min={1} max={50} value={values.positions} onChange={(positions) => set({ positions })} error={errors.positions} hint="Creatives shown at the same time" required />
        <NumberField label="Potential / month" prefix="₹" min={0} value={values.potentialMonthly} onChange={(potentialMonthly) => set({ potentialMonthly })} hint="Revenue at full occupancy (rate card)" />
        <div style={{ alignSelf: "center" }}>
          <CheckField label="Self-serve booking" hint="Brands can book this slot on the Advertise page" checked={values.bookable} onChange={(bookable) => set({ bookable })} />
        </div>
        <TextAreaField wide label="Notes for advertisers" rows={2} maxLength={500} value={values.description} onChange={(description) => set({ description })} placeholder="e.g. Best for launches — first thing shoppers see" />
      </div>
      <FormError message={lastError && !Object.keys(lastError.fields).length ? lastError.message : null} />
      <div className="ag-row">
        <button type="submit" className="btn btn-dark btn-sm" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save settings"}
        </button>
        {dirty ? <span className="am-muted" style={{ fontSize: 12.5 }}>Unsaved changes</span> : null}
      </div>
    </form>
  );
}
