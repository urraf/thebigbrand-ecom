"use client";
/**
 * Buttons that call the admin API.
 *
 * ActionButton — fires immediately:
 *   <ActionButton url={`/api/v1/admin/orders/${n}/status`} body={{ to: "CONFIRMED" }} success="Order confirmed">Confirm</ActionButton>
 *
 * ConfirmButton — asks first (modal), optionally collects a reason / extra fields:
 *   <ConfirmButton url={`/api/v1/admin/approvals/${id}`} body={{ action: "reject" }}
 *     title="Reject this product?" message="The seller will see your reason." confirmLabel="Reject" tone="danger"
 *     reason={{ label: "Reason", field: "reason", required: true, placeholder: "Images are blurry…" }}
 *     success="Product rejected" className="btn btn-ghost btn-sm">Reject</ConfirmButton>
 *
 * Both: method (default POST), redirect after success, `refresh` (default true), any `className`.
 */
import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import type { IconName } from "@/components/ui/icon";
import { Modal } from "./modal";
import { useAdminAction } from "./use-admin-action";

type Common = {
  url: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  success?: string;
  icon?: IconName;
  redirect?: string;
  refresh?: boolean;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
};

export function ActionButton({ url, method = "POST", body, success, icon, redirect, refresh, className = "btn btn-ghost btn-sm", children, disabled, title, ariaLabel }: Common) {
  const { run, busy } = useAdminAction();
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      title={title}
      aria-label={ariaLabel}
      onClick={() => run(url, { method, body: body ?? (method === "DELETE" ? undefined : {}) }, { success, icon, redirect, refresh })}
    >
      {children}
    </button>
  );
}

export function ConfirmButton({
  url,
  method = "POST",
  body,
  success,
  icon,
  redirect,
  refresh,
  className = "btn btn-ghost btn-sm",
  children,
  disabled,
  title: btnTitle,
  ariaLabel,
  confirm,
  message,
  confirmLabel = "Confirm",
  tone = "primary",
  reason,
}: Common & {
  /** dialog title */
  confirm: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "ok";
  /** collect free text sent as body[field] */
  reason?: { label: string; field: string; required?: boolean; placeholder?: string; minLength?: number };
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  async function go() {
    if (reason?.required && text.trim().length < (reason.minLength ?? 3)) {
      setErr(`Please write at least ${reason.minLength ?? 3} characters`);
      return;
    }
    const payload = { ...(body ?? {}), ...(reason ? { [reason.field]: text.trim() || undefined } : {}) };
    const res = await run(url, { method, body: method === "DELETE" && !reason && !body ? undefined : payload }, { success, icon, redirect, refresh });
    if (res !== null) {
      setOpen(false);
      setText("");
    }
  }

  const btnCls = tone === "danger" ? "btn btn-danger" : tone === "ok" ? "btn btn-ok" : "btn btn-dark";
  return (
    <>
      <button type="button" className={className} disabled={disabled || busy} title={btnTitle} aria-label={ariaLabel} onClick={() => { setErr(null); setOpen(true); }}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={confirm}
        size="sm"
        locked={busy}
        onSubmit={go}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={cx(btnCls)} disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Working…" : confirmLabel}
            </button>
          </>
        }
      >
        {message ? <p style={{ fontSize: 14, color: "var(--am-ink-2)", lineHeight: 1.5 }}>{message}</p> : null}
        {reason ? (
          <div className={cx("am-field", err && "is-bad")} style={{ marginTop: message ? 14 : 0 }}>
            <label htmlFor="am-confirm-reason">
              {reason.label}
              {reason.required ? <em aria-hidden="true">*</em> : null}
            </label>
            <textarea
              id="am-confirm-reason"
              rows={3}
              value={text}
              maxLength={500}
              onChange={(e) => {
                setText(e.target.value);
                setErr(null);
              }}
              placeholder={reason.placeholder}
              autoFocus
            />
            {err ? <span className="am-ferr">{err}</span> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
