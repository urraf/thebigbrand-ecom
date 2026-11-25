"use client";
/** Seller sign-in: email + password, scope "seller" (POST /api/v1/auth/login). */
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { api, ApiFailure } from "./api";
import { SLink } from "./link";
import { safeNext } from "./paths";
import { useSellerHref } from "./use-seller-href";

type LoginOut = { user: { role: string; name: string | null }; seller?: { status: string; displayName: string } | null };

export function LoginForm() {
  const router = useRouter();
  const href = useSellerHref();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; register?: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError({ msg: "Enter the email you registered with" });
    if (!password) return setError({ msg: "Enter your password" });
    setBusy(true);
    try {
      const out = await api<LoginOut>("/api/v1/auth/login", { body: { email: email.trim(), password, scope: "seller" } });
      if (!out.seller) {
        setError({ msg: "This account doesn't have a seller profile yet.", register: true });
        setBusy(false);
        return;
      }
      const dest = out.seller.status === "APPROVED" ? safeNext(params.get("next"), "/seller") : "/seller/status";
      router.replace(dest.startsWith("/seller") ? href(dest) : dest);
      router.refresh();
    } catch (ex) {
      const msg = ex instanceof ApiFailure ? (ex.code === "FORBIDDEN" ? "This isn't a seller account. Use the email you applied with, or start a new application." : ex.message) : "Couldn't sign in — try again";
      setError({ msg, register: ex instanceof ApiFailure && ex.code === "FORBIDDEN" });
      setBusy(false);
    }
  }

  return (
    <form className="sa-form" onSubmit={submit} noValidate>
      {error ? (
        <div className="sa-alert" role="alert">
          <Icon name="info" />
          <span>
            {error.msg}{" "}
            {error.register ? <SLink href="/seller/register">Apply to sell</SLink> : null}
          </span>
        </div>
      ) : null}
      <label className="sa-field">
        <span>Email</span>
        <input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.in" autoFocus aria-invalid={!!error && !email ? true : undefined} />
      </label>
      <label className="sa-field">
        <span>
          Password <SLink href="/seller/forgot">Forgot password?</SLink>
        </span>
        <span className="sa-pw">
          <input type={show ? "text" : "password"} name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        </span>
      </label>
      <button type="submit" className="btn btn-cart sa-submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in to Seller Central"}
      </button>
    </form>
  );
}
