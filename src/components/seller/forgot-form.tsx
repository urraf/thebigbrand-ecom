"use client";
/** Forgot password: email → 6-digit code to the registered mobile → new password (signs you in). */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, errorText } from "./api";
import { SLink } from "./link";
import { useSellerHref } from "./use-seller-href";

export function ForgotForm() {
  const router = useRouter();
  const href = useSellerHref();
  const [stage, setStage] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter the email you registered with");
    setBusy(true);
    try {
      const out = await api<{ devOtp?: string }>("/api/v1/seller/password/forgot", { body: { email: email.trim() } });
      setDevOtp(out.devOtp ?? null);
      setStage("reset");
    } catch (ex) {
      setError(errorText(ex));
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("New password: at least 8 characters with letters and a number");
    setBusy(true);
    try {
      await api("/api/v1/seller/password/reset", { body: { email: email.trim(), code, password } });
      toast("Password updated — you're signed in", { icon: "check" });
      router.replace(href("/seller"));
      router.refresh();
    } catch (ex) {
      setError(errorText(ex));
      setBusy(false);
    }
  }

  if (stage === "email") {
    return (
      <form className="sa-form" onSubmit={send} noValidate>
        {error ? (
          <div className="sa-alert" role="alert">
            <Icon name="info" />
            <span>{error}</span>
          </div>
        ) : null}
        <label className="sa-field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.in" autoFocus />
          <small>We&apos;ll text a 6-digit code to the mobile number on your seller account.</small>
        </label>
        <button type="submit" className="btn btn-cart sa-submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Send reset code"}
        </button>
        <p className="sa-alt">
          Remembered it? <SLink href="/seller/login">Back to sign in</SLink>
        </p>
      </form>
    );
  }

  return (
    <form className="sa-form" onSubmit={reset} noValidate>
      <div className="sa-alert sa-alert-ok">
        <Icon name="phone" />
        <span>
          If <b>{email}</b> belongs to a seller account, we&apos;ve sent a 6-digit code to its registered mobile number. It expires in 5 minutes.
        </span>
      </div>
      {devOtp ? (
        <p className="sa-demo">
          Demo mode (no SMS provider): your code is <b>{devOtp}</b>
        </p>
      ) : null}
      {error ? (
        <div className="sa-alert" role="alert">
          <Icon name="info" />
          <span>{error}</span>
        </div>
      ) : null}
      <label className="sa-field">
        <span>6-digit code</span>
        <input className="sa-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
      </label>
      <label className="sa-field">
        <span>New password</span>
        <span className="sa-pw">
          <input type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        </span>
        <small>At least 8 characters, with letters and a number. You&apos;ll be signed out on other devices.</small>
      </label>
      <button type="submit" className="btn btn-cart sa-submit" disabled={busy} aria-busy={busy || undefined}>
        {busy ? "Updating…" : "Set new password"}
      </button>
      <p className="sa-alt">
        Didn&apos;t get it?{" "}
        <button type="button" className="link" onClick={() => send()} disabled={busy}>
          Send a new code
        </button>
      </p>
    </form>
  );
}
