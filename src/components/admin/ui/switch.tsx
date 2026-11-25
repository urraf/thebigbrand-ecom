"use client";
/**
 * Switch (`.am-sw`) — accessible on/off toggle.
 *   <Switch checked={on} onChange={setOn} label="Show at checkout" />
 *
 * ApiSwitch — toggles a boolean through the admin API, optimistic, then refreshes Server Components.
 *   <ApiSwitch checked={brand.storeActive} url={`/api/v1/admin/brands/${brand.id}`} field="storeActive"
 *              label={`${brand.name} brand store`} onText="Brand store live" offText="Brand store off" showState />
 */
import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { useAdminAction } from "./use-admin-action";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  busy,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      className="am-sw"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => !busy && onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function ApiSwitch({
  checked,
  url,
  field,
  method = "PATCH",
  label,
  onText,
  offText,
  showState,
  successOn,
  successOff,
  disabled,
  className,
}: {
  checked: boolean;
  url: string;
  /** body = { [field]: next } */
  field: string;
  method?: "PATCH" | "POST" | "PUT";
  label: string;
  onText?: string;
  offText?: string;
  /** render the "Live"/"Paused" text next to the switch */
  showState?: boolean;
  successOn?: string;
  successOff?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [on, setOn] = useState(checked);
  const [seen, setSeen] = useState(checked);
  const { run, busy } = useAdminAction();
  // re-sync when the server value changes (after router.refresh)
  if (checked !== seen) {
    setSeen(checked);
    setOn(checked);
  }

  async function toggle(next: boolean) {
    setOn(next);
    const ok = await run(url, { method, body: { [field]: next } }, { success: next ? successOn : successOff, icon: next ? "play" : "pause" });
    if (ok === null) setOn(!next);
  }

  return (
    <span className={cx("am-st", className)}>
      <Switch checked={on} onChange={toggle} label={label} busy={busy} disabled={disabled} />
      {showState ? <span className={on ? "on" : undefined}>{on ? (onText ?? "On") : (offText ?? "Off")}</span> : null}
    </span>
  );
}
