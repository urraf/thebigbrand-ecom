"use client";
/**
 * Form field components (controlled). Each renders label + control + hint + inline error (`.am-field`).
 *
 *   <TextField label="Name" required value={v.name} onChange={(name) => set({ name })} error={errors.name} />
 *   <MoneyField label="Price" value={v.price} onChange={(price) => set({ price })} />      // ₹ integer rupees
 *   <NumberField label="Stock" value={v.stock} onChange={…} min={0} suffix="units" />
 *   <SelectField label="Brand" value={v.brandId} onChange={…} options={[{ value, label }]} placeholder="Choose…" />
 *   <TextAreaField label="Description" rows={5} … />
 *   <CheckField label="Featured" hint="Shown on the homepage" checked={v.featured} onChange={…} />
 *   <TagsField label="Search tags" value={v.tags} onChange={…} placeholder="Type and press Enter" />
 *   <ColorField label="Brand colour" value={v.color} onChange={…} />
 *   <MultiToggle label="Concerns" value={v.concerns} onChange={…} options={[{ value: "acne", label: "Acne" }]} />
 *   <FormError message={formError} />
 *
 * `useForm(initial)` gives `{ values, set, errors, setErrors }` with field-level errors from the API.
 */
import { useCallback, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";

export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = useCallback((patch: Partial<T>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const keys = Object.keys(patch);
      if (!keys.some((k) => e[k])) return e;
      const n = { ...e };
      for (const k of keys) delete n[k];
      return n;
    });
  }, []);
  return { values, set, setValues, errors, setErrors };
}

type BaseProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  /** span both columns of an .am-fgrid */
  wide?: boolean;
};

export function Field({ label, hint, error, required, className, wide, htmlFor, children }: BaseProps & { htmlFor?: string; children: ReactNode }) {
  return (
    <div className={cx("am-field", error && "is-bad", wide && "am-wide", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor}>
          {label}
          {required ? <em aria-hidden="true">*</em> : null}
        </label>
      ) : (
        <span className="am-field-l">
          {label}
          {required ? <em aria-hidden="true">*</em> : null}
        </span>
      )}
      {children}
      {error ? (
        <span className="am-ferr" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="am-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  autoComplete,
  inputMode,
  disabled,
  mono,
  ...base
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url" | "password" | "date" | "datetime-local";
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "email" | "tel" | "url";
  disabled?: boolean;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <Field {...base} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        required={base.required}
        aria-invalid={base.error ? true : undefined}
        style={mono ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 } : undefined}
      />
    </Field>
  );
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  prefix,
  placeholder,
  disabled,
  ...base
}: BaseProps & {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const input = (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(numOrNull(e.target.value))}
      required={base.required}
      aria-invalid={base.error ? true : undefined}
    />
  );
  return (
    <Field {...base} htmlFor={id}>
      {prefix || suffix ? (
        <span className={cx("am-rsin", suffix && !prefix && "is-sfx")}>
          <i aria-hidden="true">{prefix ?? suffix}</i>
          {input}
        </span>
      ) : (
        input
      )}
    </Field>
  );
}

export function MoneyField(props: BaseProps & { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; placeholder?: string; disabled?: boolean }) {
  return <NumberField {...props} prefix="₹" step={1} min={props.min ?? 0} />;
}

export function TextAreaField({
  value,
  onChange,
  rows = 4,
  placeholder,
  maxLength,
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return (
    <Field {...base} htmlFor={id}>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-invalid={base.error ? true : undefined} />
    </Field>
  );
}

export type Option = { value: string; label: string; disabled?: boolean };

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  groups,
  ...base
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  options?: Option[];
  groups?: Array<{ label: string; options: Option[] }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field {...base} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={base.required} aria-invalid={base.error ? true : undefined}>
        {placeholder != null ? <option value="">{placeholder}</option> : null}
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {(groups ?? []).map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

export function CheckField({
  label,
  hint,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cx("am-check", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span>
        <b>{label}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

export function TagsField({
  value,
  onChange,
  placeholder = "Type and press Enter",
  max = 30,
  lowercase,
  ...base
}: BaseProps & { value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; lowercase?: boolean }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => (lowercase ? s.trim().toLowerCase() : s.trim()))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && next.length < max) next.push(p.slice(0, 80));
    onChange(next);
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }
  return (
    <Field {...base} htmlFor={id}>
      <div className="am-tagsin" onClick={() => document.getElementById(id)?.focus()}>
        {value.map((t) => (
          <span key={t}>
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <Icon name="close" />
            </button>
          </span>
        ))}
        <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => add(draft)} placeholder={value.length ? "" : placeholder} />
      </div>
    </Field>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;
export function ColorField({ value, onChange, ...base }: BaseProps & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Field {...base} htmlFor={id}>
      <span className="am-color">
        <input type="color" value={HEX.test(value) ? value : "#17121f"} onChange={(e) => onChange(e.target.value)} aria-label="Pick colour" />
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} placeholder="#17121f" aria-invalid={base.error ? true : undefined} />
      </span>
    </Field>
  );
}

export function MultiToggle({ value, onChange, options, ...base }: BaseProps & { value: string[]; onChange: (v: string[]) => void; options: Option[] }) {
  return (
    <Field {...base}>
      <div className="am-multi" role="group">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>
              {o.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="am-ferrbox" role="alert">
      <Icon name="info" />
      <span>{message}</span>
    </div>
  );
}
