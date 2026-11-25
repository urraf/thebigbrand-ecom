"use client";
/**
 * SIGN IN — OTP first (mobile → 6-digit code via /api/v1/auth/otp/request + verify; the dev OTP is shown as a
 * "Demo OTP" hint), a name step for new accounts, and an email tab for password sign-in / sign-up.
 * Honours ?next= (same-site paths only) and refreshes the router so the store chrome picks up the session.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import { apiFieldErrors, capi, errMessage, omit } from "../api";
import { safeNext } from "../next-path";

type Tab = "otp" | "email";
type SignedIn = { user: { id: string; name: string | null; role: string }; isNew?: boolean };

export function LoginClient({ next }: { next: string }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [tab, setTab] = useState<Tab>("otp");
  const dest = safeNext(next);
  const checkout = dest.startsWith("/checkout");

  const done = async (r: SignedIn) => {
    await refresh();
    toast(r.user.name ? `Welcome${r.isNew ? "" : " back"}, ${r.user.name.split(" ")[0]}!` : "You're signed in", { icon: "check" });
    router.replace(dest);
    router.refresh();
  };

  return (
    <section className="wrap cm-login">
      <div className="cm-login-card">
        <aside className="cm-login-art" aria-hidden="true">
          <span className="cm-login-k">
            <Icon name="gift" /> Free gift in every order
          </span>
          <h2>
            India&rsquo;s beauty marketplace, <em>with a gift you choose.</em>
          </h2>
          <ul>
            <li>
              <Icon name="shield" /> 100% authentic — from brands &amp; authorised sellers
            </li>
            <li>
              <Icon name="gift" /> Pick up to 3 TBB Originals minis before you pay
            </li>
            <li>
              <Icon name="truck" /> Free delivery over ₹499 · easy 7-day returns
            </li>
          </ul>
          <div className="cm-login-blobs">
            <i />
            <i />
            <i />
          </div>
        </aside>
        <div className="cm-login-main">
          <h1>{checkout ? "Sign in to check out" : "Sign in or create an account"}</h1>
          <p className="muted">{checkout ? "Your cart is saved — sign in to pick your free gift and pay." : "Track orders, save addresses and keep your wishlist across devices."}</p>
          <div className="cm-tabs" role="tablist" aria-label="Sign-in method">
            <button type="button" role="tab" aria-selected={tab === "otp"} className={cx(tab === "otp" && "is-on")} onClick={() => setTab("otp")}>
              <Icon name="phone" /> Mobile number
            </button>
            <button type="button" role="tab" aria-selected={tab === "email"} className={cx(tab === "email" && "is-on")} onClick={() => setTab("email")}>
              <Icon name="user" /> Email
            </button>
          </div>
          {tab === "otp" ? <OtpFlow onDone={done} /> : <EmailFlow onDone={done} />}
          <p className="cm-login-legal">
            By continuing you agree to our Conditions of Use and Privacy Notice. Selling on The Big Brands?{" "}
            <Link href="/seller/login" className="link">
              Seller login
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function OtpFlow({ onDone }: { onDone: (r: SignedIn) => Promise<void> }) {
  const [stage, setStage] = useState<"phone" | "code" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [signed, setSigned] = useState<SignedIn | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const digits = phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^[6-9]\d{9}$/.test(digits)) return setError("Enter a valid 10-digit mobile number");
    setBusy(true);
    setError(null);
    try {
      const r = await capi<{ devOtp?: string; expiresInSec: number }>("/api/v1/auth/otp/request", { method: "POST", json: { phone: digits } });
      setDevOtp(r.devOtp ?? null);
      setStage("code");
      setCode("");
      setResendIn(30);
      setTimeout(() => codeRef.current?.focus(), 30);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return setError("Enter the 6-digit code");
    setBusy(true);
    setError(null);
    try {
      const r = await capi<SignedIn>("/api/v1/auth/otp/verify", { method: "POST", json: { phone: digits, code: value } });
      if (!r.user.name) {
        setSigned(r);
        setStage("name");
        setBusy(false);
        return;
      }
      await onDone(r);
    } catch (err) {
      setError(errMessage(err));
      setBusy(false);
    }
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter your name");
    setBusy(true);
    setError(null);
    try {
      const p = await capi<{ name: string | null }>("/api/v1/account/profile", { method: "PATCH", json: { name: name.trim() } });
      await onDone({ ...signed!, user: { ...signed!.user, name: p.name } });
    } catch (err) {
      setError(errMessage(err));
      setBusy(false);
    }
  };

  if (stage === "name") {
    return (
      <form className="cm-lf" onSubmit={saveName}>
        <p className="cm-alert is-ok">
          <Icon name="check" />
          <span>
            Welcome to The Big Brands! <b>+91 {digits}</b> is verified.
          </span>
        </p>
        <div className="co-f">
          <label htmlFor="lg-name">What should we call you?</label>
          <input id="lg-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your full name" maxLength={80} autoFocus />
        </div>
        {error ? <Err text={error} /> : null}
        <button type="submit" className="btn btn-cart btn-lg cm-lf-cta" disabled={busy}>
          {busy ? <Spin /> : null}Continue <Icon name="arrow" />
        </button>
        <button type="button" className="co-tb cm-skip" onClick={() => signed && onDone(signed)} disabled={busy}>
          Skip for now
        </button>
      </form>
    );
  }

  if (stage === "code") {
    return (
      <form
        className="cm-lf"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <p className="cm-otp-to">
          Enter the 6-digit code sent to <b>+91 {digits.replace(/(\d{5})(\d{5})/, "$1 $2")}</b>
          <button type="button" className="co-tb" onClick={() => setStage("phone")}>
            Change
          </button>
        </p>
        <div className="co-f">
          <label htmlFor="lg-code" className="sr-only">
            One-time code
          </label>
          <input
            ref={codeRef}
            id="lg-code"
            className="cm-otp"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              setError(null);
              if (v.length === 6) void verify(v);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={6}
            aria-invalid={error ? true : undefined}
          />
        </div>
        {devOtp ? (
          <p className="cm-devotp">
            <Icon name="info" />
            <span>
              Demo OTP: <b>{devOtp}</b>
            </span>
            <button
              type="button"
              className="co-tb"
              onClick={() => {
                setCode(devOtp);
                void verify(devOtp);
              }}
            >
              Use it
            </button>
          </p>
        ) : null}
        {error ? <Err text={error} /> : null}
        <button type="submit" className="btn btn-cart btn-lg cm-lf-cta" disabled={busy || code.length !== 6}>
          {busy ? <Spin /> : null}Verify &amp; continue
        </button>
        <p className="cm-resend">
          Didn&rsquo;t get it?{" "}
          {resendIn > 0 ? (
            <span>Resend in {resendIn}s</span>
          ) : (
            <button type="button" className="co-tb" onClick={() => send()} disabled={busy}>
              Resend code
            </button>
          )}
        </p>
      </form>
    );
  }

  return (
    <form className="cm-lf" onSubmit={send}>
      <div className="co-f">
        <label htmlFor="lg-phone">Mobile number</label>
        <div className="co-pre">
          <span aria-hidden="true">+91</span>
          <input
            id="lg-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^\d\s+-]/g, "").slice(0, 14));
              setError(null);
            }}
            placeholder="98765 43210"
            aria-invalid={error ? true : undefined}
            autoFocus
          />
        </div>
      </div>
      {error ? <Err text={error} /> : null}
      <button type="submit" className="btn btn-cart btn-lg cm-lf-cta" disabled={busy}>
        {busy ? <Spin /> : null}Get OTP <Icon name="arrow" />
      </button>
      <p className="cm-lf-note">
        <Icon name="shield" /> New here? We&rsquo;ll create your account after you verify — no password needed.
      </p>
    </form>
  );
}

function EmailFlow({ onDone }: { onDone: (r: SignedIn) => Promise<void> }) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [v, setV] = useState({ name: "", email: "", password: "", phone: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setFe((f) => omit(f, k));
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (mode === "register" && v.name.trim().length < 2) errs.name = "Enter your name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errs.email = "Enter a valid email address";
    if (mode === "register" ? v.password.length < 8 : !v.password) errs.password = mode === "register" ? "Use at least 8 characters" : "Enter your password";
    if (mode === "register" && v.phone && !/^[6-9]\d{9}$/.test(v.phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))) errs.phone = "Enter a valid 10-digit mobile number";
    if (Object.keys(errs).length) return setFe(errs);
    setBusy(true);
    try {
      const r =
        mode === "signin"
          ? await capi<SignedIn>("/api/v1/auth/login", { method: "POST", json: { email: v.email.trim(), password: v.password, scope: "customer" } })
          : await capi<SignedIn>("/api/v1/auth/register", { method: "POST", json: { name: v.name.trim(), email: v.email.trim(), password: v.password, ...(v.phone ? { phone: v.phone } : {}) } });
      await onDone(r);
    } catch (err) {
      const f = apiFieldErrors(err);
      if (Object.keys(f).length) setFe(f);
      else setError(errMessage(err));
      setBusy(false);
    }
  };

  const fieldCls = (k: string) => cx("co-f", fe[k] && "is-err");
  const ferr = (k: string) => (
    <small className="co-err" aria-live="polite">
      {fe[k] ? (
        <>
          <Icon name="info" />
          {fe[k]}
        </>
      ) : null}
    </small>
  );

  return (
    <form className="cm-lf" onSubmit={submit} noValidate>
      {mode === "register" ? (
        <div className={fieldCls("name")}>
          <label htmlFor="lg-n">Full name</label>
          <input id="lg-n" value={v.name} onChange={set("name")} autoComplete="name" maxLength={80} />
          {ferr("name")}
        </div>
      ) : null}
      <div className={fieldCls("email")}>
        <label htmlFor="lg-e">Email</label>
        <input id="lg-e" type="email" value={v.email} onChange={set("email")} autoComplete="email" maxLength={160} />
        {ferr("email")}
      </div>
      <div className={fieldCls("password")}>
        <label htmlFor="lg-p">Password</label>
        <div className="cm-pw">
          <input id="lg-p" type={show ? "text" : "password"} value={v.password} onChange={set("password")} autoComplete={mode === "signin" ? "current-password" : "new-password"} maxLength={200} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        </div>
        {ferr("password")}
      </div>
      {mode === "register" ? (
        <div className={fieldCls("phone")}>
          <label htmlFor="lg-ph">
            Mobile number <em>(optional — for delivery updates)</em>
          </label>
          <div className="co-pre">
            <span aria-hidden="true">+91</span>
            <input id="lg-ph" type="tel" inputMode="numeric" value={v.phone} onChange={set("phone")} autoComplete="tel-national" maxLength={14} />
          </div>
          {ferr("phone")}
        </div>
      ) : null}
      {error ? <Err text={error} /> : null}
      <button type="submit" className="btn btn-cart btn-lg cm-lf-cta" disabled={busy}>
        {busy ? <Spin /> : null}
        {mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <p className="cm-lf-switch">
        {mode === "signin" ? (
          <>
            New to The Big Brands?{" "}
            <button type="button" className="co-tb" onClick={() => setMode("register")}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" className="co-tb" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}

const Spin = () => <span className="co-spin" aria-hidden="true" />;
const Err = ({ text }: { text: string }) => (
  <p className="cm-alert is-err" role="alert">
    <Icon name="info" />
    <span>{text}</span>
  </p>
);
