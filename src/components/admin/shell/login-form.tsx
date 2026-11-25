"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";

/** Where to go after sign-in: ?next when it's a safe same-site path, else the dashboard. */
function nextPath(): string {
  const raw = new URLSearchParams(window.location.search).get("next") ?? "";
  const onAdminHost = window.location.hostname.startsWith("admin.");
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return onAdminHost ? "/" : "/admin";
  if (onAdminHost) return raw;
  return raw === "/admin" || raw.startsWith("/admin/") ? (raw.startsWith("/admin/login") ? "/admin" : raw) : "/admin";
}

export function AdminLoginForm({ demo }: { demo?: { email: string; password: string } | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter the email address of your admin account");
    if (!password) return setError("Enter your password");
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, scope: "admin" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? "Couldn't sign you in — please try again");
        setBusy(false);
        return;
      }
      router.replace(nextPath());
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again");
      setBusy(false);
    }
  }

  return (
    <form className="aml-form" onSubmit={submit} noValidate>
      <div className="am-field">
        <label htmlFor="aml-email">Work email</label>
        <input
          id="aml-email"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@thebigbrands.co.in"
          autoFocus
          required
        />
      </div>
      <div className="am-field">
        <label htmlFor="aml-pass">Password</label>
        <span className="aml-pass">
          <input
            id="aml-pass"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <button type="button" className="am-iconbtn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        </span>
      </div>
      {error ? (
        <div className="am-ferrbox" role="alert">
          <Icon name="info" />
          <span>{error}</span>
        </div>
      ) : null}
      <button type="submit" className="btn btn-cart btn-lg aml-submit" disabled={busy} aria-busy={busy || undefined}>
        {busy ? "Signing in…" : "Sign in to admin"}
        {!busy ? <Icon name="arrow" /> : null}
      </button>
      {demo ? (
        <button
          type="button"
          className="aml-demo"
          onClick={() => {
            setEmail(demo.email);
            setPassword(demo.password);
          }}
        >
          <Icon name="sparkle" />
          <span>
            Demo account <b>{demo.email}</b> · tap to fill
          </span>
        </button>
      ) : null}
    </form>
  );
}
