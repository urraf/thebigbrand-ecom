"use client";
/** Contact form → POST /api/v1/support/contact. Shows field errors inline and a reference number on success. */
import { useState } from "react";
import Link from "next/link";
import { capi, CommerceError } from "@/components/commerce/api";
import { Icon } from "@/components/ui/icon";

type Topic = { value: string; label: string };
type Values = { topic: string; name: string; email: string; phone: string; orderNumber: string; message: string; website: string };
type Sent = { reference: string };

export function ContactForm({ topics, initial }: { topics: Topic[]; initial: Partial<Values> }) {
  const [v, setV] = useState<Values>({ topic: "", name: "", email: "", phone: "", orderNumber: "", message: "", website: "", ...initial });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  function check(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!v.topic) e.topic = "Choose what it's about";
    if (v.name.trim().length < 2) e.name = "Please enter your name";
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "Please enter a valid email";
    if (v.phone.trim() && !/^(\+?91)?[6-9]\d{9}$/.test(v.phone.replace(/[\s-]/g, ""))) e.phone = "Enter a 10-digit mobile number";
    if (v.message.trim().length < 10) e.message = "Tell us a little more (at least 10 characters)";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormErr(null);
    const e = check();
    setErrs(e);
    if (Object.keys(e).length) {
      document.getElementById(`ct-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const out = await capi<Sent>("/api/v1/support/contact", { method: "POST", json: v });
      setSent(out);
    } catch (ex) {
      if (ex instanceof CommerceError) {
        const fe = ex.details?.fieldErrors ?? {};
        const mapped = Object.fromEntries(Object.entries(fe).map(([k, m]) => [k, m?.[0] ?? "Check this field"]));
        setErrs(mapped);
        setFormErr(Object.keys(mapped).length ? null : ex.message);
      } else setFormErr("Couldn't send your message — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="ct-done" role="status">
        <Icon name="check" />
        <h3>Thanks, we&apos;ve got your message</h3>
        <p>
          Your reference is <b>{sent.reference}</b>. We&apos;ll reply to <b>{v.email}</b> within 24 hours (usually much sooner).
        </p>
        <Link className="link" href="/help">
          Meanwhile, browse the Help centre <Icon name="arrow" />
        </Link>
      </div>
    );

  const field = ({ k, label, opt, wide, children }: { k: keyof Values; label: string; opt?: boolean; wide?: boolean; children: React.ReactNode }) => (
    <div className={`ct-f${wide ? " ct-wide" : ""}${errs[k] ? " is-err" : ""}`}>
      <label htmlFor={`ct-${k}`}>
        {label} {opt ? <em>(optional)</em> : null}
      </label>
      {children}
      {errs[k] ? (
        <span className="ct-err" id={`ct-${k}-err`}>
          {errs[k]}
        </span>
      ) : null}
    </div>
  );
  const aria = (k: keyof Values) => ({ id: `ct-${k}`, "aria-invalid": errs[k] ? true : undefined, "aria-describedby": errs[k] ? `ct-${k}-err` : undefined });

  return (
    <form className="ct-form" onSubmit={submit} noValidate>
      {formErr ? (
        <p className="ct-err ct-wide" role="alert">
          {formErr}
        </p>
      ) : null}
      {field({
        k: "topic",
        label: "What is it about?",
        wide: true,
        children: (
          <select {...aria("topic")} value={v.topic} onChange={set("topic")}>
            <option value="">Choose a topic…</option>
            {topics.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        ),
      })}
      {field({ k: "name", label: "Your name", children: <input {...aria("name")} value={v.name} onChange={set("name")} autoComplete="name" maxLength={80} /> })}
      {field({ k: "email", label: "Email", children: <input {...aria("email")} type="email" value={v.email} onChange={set("email")} autoComplete="email" inputMode="email" /> })}
      {field({ k: "phone", label: "Mobile", opt: true, children: <input {...aria("phone")} type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel-national" inputMode="numeric" maxLength={14} /> })}
      {field({ k: "orderNumber", label: "Order number", opt: true, children: <input {...aria("orderNumber")} value={v.orderNumber} onChange={set("orderNumber")} placeholder="e.g. TBB2611256169" maxLength={30} /> })}
      {field({ k: "message", label: "Message", wide: true, children: <textarea {...aria("message")} value={v.message} onChange={set("message")} maxLength={2000} placeholder="How can we help?" /> })}
      <div className="ct-hp" aria-hidden="true">
        <label htmlFor="ct-website">Website</label>
        <input id="ct-website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} />
      </div>
      <div className="ct-foot">
        <p>
          By sending this message you agree that we may use these details to reply, as described in our <Link href="/privacy">Privacy policy</Link>.
        </p>
        <button type="submit" className="btn btn-cart btn-lg" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
