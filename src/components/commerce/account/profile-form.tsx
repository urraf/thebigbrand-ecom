"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile } from "@/server/account/profile";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import { apiFieldErrors, capi, errMessage, omit } from "../api";
import { SignOutButton } from "./account-nav";

/** Name + email (PATCH /api/v1/account/profile); the mobile number is the OTP identity and read-only. */
export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== (p.name ?? "") || email.trim().toLowerCase() !== (p.email ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Enter your name";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errs.email = "Enter a valid email address";
    if (Object.keys(errs).length) return setFe(errs);
    setBusy(true);
    setError(null);
    try {
      const next = await capi<Profile>("/api/v1/account/profile", { method: "PATCH", json: { name: name.trim(), email: email.trim() } });
      setP(next);
      setName(next.name ?? "");
      setEmail(next.email ?? "");
      toast("Profile updated", { icon: "check" });
      router.refresh();
    } catch (err) {
      const f = apiFieldErrors(err);
      if (Object.keys(f).length) setFe(f);
      else setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const err = (k: string) => (
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
    <>
      <form className="co-form cm-prof" onSubmit={save} noValidate>
        <div className={cx("co-f co-f-wide", fe.name && "is-err")}>
          <label htmlFor="pf-name">Full name</label>
          <input
            id="pf-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFe((f) => omit(f, "name"));
            }}
            autoComplete="name"
            maxLength={80}
          />
          {err("name")}
        </div>
        <div className={cx("co-f", fe.email && "is-err")}>
          <label htmlFor="pf-email">Email {p.hasPassword ? <em>(used to sign in)</em> : <em>(for order updates)</em>}</label>
          <input
            id="pf-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFe((f) => omit(f, "email"));
            }}
            autoComplete="email"
            maxLength={160}
          />
          {err("email")}
        </div>
        <div className="co-f">
          <label htmlFor="pf-phone">Mobile number</label>
          <div className="co-pre">
            <span aria-hidden="true">+91</span>
            <input id="pf-phone" value={p.phone ?? "Not added"} readOnly aria-describedby="pf-phone-n" />
          </div>
          <small id="pf-phone-n" className="cm-help-s">
            {p.phone ? "Your sign-in number — contact support to change it." : "Sign in with OTP once to link a mobile number."}
          </small>
        </div>
        {error ? (
          <p className="cm-alert is-err co-f-wide" role="alert">
            <Icon name="info" />
            <span>{error}</span>
          </p>
        ) : null}
        <div className="co-sc-foot co-f-wide">
          <p className="co-foot-note">
            <Icon name="shield" />
            We never share your details with brands or advertisers.
          </p>
          <button type="submit" className="btn btn-cart btn-lg" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      <div className="cm-prof-sec">
        <div>
          <b>Sign out</b>
          <small>Sign out of The Big Brands on this device.</small>
        </div>
        <SignOutButton className="btn btn-ghost" />
      </div>
    </>
  );
}
