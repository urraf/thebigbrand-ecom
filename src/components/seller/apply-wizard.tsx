"use client";
/**
 * "Sell on The Big Brands" application — Account → Business → Bank → Review.
 * POST /api/v1/seller/apply. New applicants get an account (role SELLER) and are signed in; signed-in customers
 * apply with their account; PENDING / REJECTED sellers edit and resubmit. Format checks mirror the server (kyc.ts).
 * Progress (minus password and account number) is kept in localStorage so a refresh doesn't lose it.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, ApiFailure, errorText } from "./api";
import { SLink } from "./link";
import { useSellerHref } from "./use-seller-href";
import {
  GST_STATE,
  INDIAN_STATES,
  MOBILE_RE,
  PINCODE_RE,
  UPI_RE,
  gstinError,
  ifscError,
  maskAccount,
  normKyc,
  panError,
  panFromGstin,
} from "./kyc";

type Form = {
  name: string;
  email: string;
  mobile: string;
  password: string;
  businessName: string;
  displayName: string;
  gstin: string;
  pan: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  categories: string[];
  brandsAuthorised: string[];
  description: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankAccountConfirm: string;
  bankIfsc: string;
  upiId: string;
  acceptTerms: boolean;
};

export type WizardInitial = Partial<Omit<Form, "password" | "bankAccountConfirm" | "acceptTerms">>;

type Props = {
  mode: "new" | "upgrade" | "edit";
  /** signed-in user (upgrade/edit) */
  who?: { name: string | null; email: string | null; phone: string | null } | null;
  initial?: WizardInitial;
  rejectionReason?: string | null;
  categories: { slug: string; name: string }[];
  brands: string[];
};

const EMPTY: Form = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  businessName: "",
  displayName: "",
  gstin: "",
  pan: "",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  categories: [],
  brandsAuthorised: [],
  description: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankAccountConfirm: "",
  bankIfsc: "",
  upiId: "",
  acceptTerms: false,
};

const STEP_FIELDS: Record<string, (keyof Form)[]> = {
  account: ["name", "email", "mobile", "password"],
  business: ["businessName", "displayName", "gstin", "pan", "addressLine", "city", "state", "pincode", "categories", "brandsAuthorised", "description"],
  bank: ["bankAccountName", "bankAccountNumber", "bankAccountConfirm", "bankIfsc", "upiId"],
  review: ["acceptTerms"],
};
const STEP_LABEL: Record<string, string> = { account: "Account", business: "Business", bank: "Bank", review: "Review" };
const DRAFT_KEY = "tbb_seller_apply_v1";
const noopSubscribe = () => () => {};
function readDraft(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

export function ApplyWizard({ mode, who, initial, rejectionReason, categories, brands }: Props) {
  const router = useRouter();
  const href = useSellerHref();
  const steps = mode === "new" ? ["account", "business", "bank", "review"] : ["business", "bank", "review"];
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(mode === "edit" ? steps.length - 1 : 0);
  const [f, setF] = useState<Form>(() => ({
    ...EMPTY,
    name: who?.name ?? "",
    email: who?.email ?? "",
    mobile: who?.phone ?? "",
    ...(initial ?? {}),
    description: initial?.description ?? "",
    upiId: initial?.upiId ?? "",
    bankAccountConfirm: initial?.bankAccountNumber ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [brandDraft, setBrandDraft] = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // a saved draft from this device (never contains the password or account number) — offered, not auto-applied
  const savedDraft = useSyncExternalStore(noopSubscribe, readDraft, () => null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  function restoreDraft() {
    if (!savedDraft) return;
    try {
      const d = JSON.parse(savedDraft) as Partial<Form>;
      setF((p) => ({ ...p, ...d, password: "", bankAccountNumber: "", bankAccountConfirm: "", acceptTerms: false, ...(who?.email ? { email: who.email } : {}) }));
      toast("Restored your saved answers", { icon: "check" });
    } catch {
      /* corrupt draft */
    }
    setDraftDismissed(true);
  }
  useEffect(() => {
    if (mode === "edit") return;
    const t = setTimeout(() => {
      try {
        const safe = { ...f, password: undefined, bankAccountNumber: undefined, bankAccountConfirm: undefined, acceptTerms: undefined };
        if (f.businessName || f.gstin) localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
      } catch {
        /* storage unavailable */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [f, mode]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  function onGstin(v: string) {
    const g = normKyc(v).slice(0, 15);
    setF((p) => {
      const next = { ...p, gstin: g };
      if (g.length >= 12 && (!p.pan || p.pan === panFromGstin(p.gstin))) next.pan = panFromGstin(g);
      const st = GST_STATE[g.slice(0, 2)];
      if (g.length >= 2 && st && !p.state) next.state = st;
      return next;
    });
    if (errors.gstin) setErrors((e) => ({ ...e, gstin: "" }));
  }

  function validateStep(key: string): Record<string, string> {
    const e: Record<string, string> = {};
    if (key === "account") {
      if (f.name.trim().length < 2) e.name = "Enter your full name";
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email";
      if (!MOBILE_RE.test(f.mobile.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))) e.mobile = "Enter a valid 10-digit mobile number";
      if (f.password.length < 8) e.password = "Use at least 8 characters";
      else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Use letters and at least one number";
    }
    if (key === "business") {
      if (mode !== "new") {
        if (f.name.trim().length < 2) e.name = "Enter the contact person's name";
        if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email";
        if (!MOBILE_RE.test(f.mobile.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))) e.mobile = "Enter a valid 10-digit mobile number";
      }
      if (f.businessName.trim().length < 2) e.businessName = "Enter the legal business name (as on GST certificate)";
      if (f.displayName.trim().length < 2) e.displayName = "Enter a store name";
      const g = gstinError(f.gstin);
      if (g) e.gstin = g;
      const p = panError(f.pan);
      if (p) e.pan = p;
      else if (!g && panFromGstin(f.gstin) !== normKyc(f.pan)) e.pan = "PAN must match characters 3–12 of your GSTIN";
      if (f.addressLine.trim().length < 5) e.addressLine = "Enter the pickup address";
      if (f.city.trim().length < 2) e.city = "Enter the city";
      if (!f.state) e.state = "Choose a state";
      if (!PINCODE_RE.test(f.pincode)) e.pincode = "6-digit PIN code";
      if (!f.categories.length) e.categories = "Pick at least one category";
      if (!f.brandsAuthorised.length) e.brandsAuthorised = "Add at least one brand you're authorised to sell";
    }
    if (key === "bank") {
      if (f.bankAccountName.trim().length < 2) e.bankAccountName = "Enter the account holder name";
      if (!/^\d{9,18}$/.test(f.bankAccountNumber)) e.bankAccountNumber = "Account number has 9–18 digits";
      else if (f.bankAccountConfirm !== f.bankAccountNumber) e.bankAccountConfirm = "Account numbers don't match";
      const i = ifscError(f.bankIfsc);
      if (i) e.bankIfsc = i;
      if (f.upiId.trim() && !UPI_RE.test(f.upiId.trim())) e.upiId = "UPI ID looks like name@bank";
    }
    if (key === "review" && !f.acceptTerms) e.acceptTerms = "Please accept the seller terms";
    return e;
  }

  function go(i: number) {
    setStep(i);
    setMaxStep((m) => Math.max(m, i));
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function next() {
    const e = validateStep(steps[step]);
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      const first = Object.keys(e)[0];
      document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    go(step + 1);
  }

  async function submit() {
    const all: Record<string, string> = {};
    for (const s of steps) Object.assign(all, validateStep(s));
    setErrors(all);
    const bad = Object.keys(all).find((k) => all[k]);
    if (bad) {
      const idx = steps.findIndex((s) => STEP_FIELDS[s].includes(bad as keyof Form) || (s === "business" && ["name", "email", "mobile"].includes(bad)));
      if (idx >= 0 && idx !== step) go(idx);
      toast("Please fix the highlighted fields", { icon: "info" });
      return;
    }
    setBusy(true);
    const body = {
      name: f.name.trim(),
      email: f.email.trim(),
      mobile: f.mobile,
      ...(mode === "new" ? { password: f.password } : {}),
      businessName: f.businessName.trim(),
      displayName: f.displayName.trim(),
      gstin: f.gstin,
      pan: f.pan,
      addressLine: f.addressLine.trim(),
      city: f.city.trim(),
      state: f.state,
      pincode: f.pincode,
      categories: f.categories,
      brandsAuthorised: f.brandsAuthorised,
      description: f.description.trim() || null,
      bankAccountName: f.bankAccountName.trim(),
      bankAccountNumber: f.bankAccountNumber,
      bankIfsc: f.bankIfsc,
      upiId: f.upiId.trim() || null,
      acceptTerms: true,
    };
    try {
      await api("/api/v1/seller/apply", { body });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      toast(mode === "edit" ? "Application updated — back in the review queue" : "Application submitted — we'll review it within 2 working days", { icon: "check" });
      router.replace(href("/seller/status"));
      router.refresh();
    } catch (ex) {
      if (ex instanceof ApiFailure && ex.code === "CONFLICT" && (ex.fields.email || ex.fields.mobile)) setAccountExists(true);
      if (ex instanceof ApiFailure && Object.keys(ex.fields).length) {
        const fe = Object.fromEntries(Object.entries(ex.fields).map(([k, v]) => [k, v?.[0] ?? "Check this field"]));
        setErrors(fe);
        const k = Object.keys(fe)[0];
        const idx = steps.findIndex((s) => STEP_FIELDS[s].includes(k as keyof Form) || (s === "business" && ["name", "email", "mobile"].includes(k)));
        if (idx >= 0) go(idx);
      }
      toast(errorText(ex), { icon: "info" });
      setBusy(false);
    }
  }

  const err = (k: keyof Form) => (errors[k] ? <small className="sa-err" id={`e-${k}`}>{errors[k]}</small> : null);
  const inv = (k: keyof Form) => ({ name: k, "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `e-${k}` : undefined });

  const brandSugg = useMemo(() => {
    const q = brandDraft.trim().toLowerCase();
    return brands.filter((b) => !f.brandsAuthorised.includes(b) && (!q || b.toLowerCase().includes(q))).slice(0, 10);
  }, [brands, brandDraft, f.brandsAuthorised]);
  function addBrand(v: string) {
    const name = v.trim().replace(/,$/, "");
    if (name.length < 2) return;
    const canonical = brands.find((b) => b.toLowerCase() === name.toLowerCase()) ?? name;
    if (!f.brandsAuthorised.includes(canonical)) set("brandsAuthorised", [...f.brandsAuthorised, canonical].slice(0, 25));
    setBrandDraft("");
  }

  const cur = steps[step];
  const catName = (s: string) => categories.find((c) => c.slug === s)?.name ?? s;

  return (
    <div className="sa-card" ref={top}>
      <ol className="sa-steps" style={{ ["--n" as string]: steps.length }} aria-label="Application steps">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? "done" : i === step ? "cur" : undefined} aria-current={i === step ? "step" : undefined}>
            <button type="button" disabled={i > maxStep || busy} onClick={() => go(i)}>
              {i + 1}. {STEP_LABEL[s]}
            </button>
          </li>
        ))}
      </ol>

      {rejectionReason && mode === "edit" ? (
        <div className="sa-alert" role="note">
          <Icon name="info" />
          <span>
            <b>Changes requested:</b> {rejectionReason}
          </span>
        </div>
      ) : null}
      {savedDraft && !draftDismissed && mode !== "edit" && !f.businessName ? (
        <div className="sa-alert sa-alert-info">
          <Icon name="clock" />
          <span style={{ flex: 1 }}>You have an unfinished application saved on this device.</span>
          <button type="button" className="btn btn-dark btn-sm" onClick={restoreDraft}>
            Restore
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              try {
                localStorage.removeItem(DRAFT_KEY);
              } catch {
                /* ignore */
              }
              setDraftDismissed(true);
            }}
          >
            Start fresh
          </button>
        </div>
      ) : null}
      {accountExists && mode === "new" ? (
        <div className="sa-alert sa-alert-warn" role="alert">
          <Icon name="user" />
          <span>
            You already have a The Big Brands account with this email or mobile. <a href={href.store("/login?next=/seller/register")}>Sign in with it</a> and
            we&apos;ll bring you straight back here — your answers are saved.
          </span>
        </div>
      ) : null}
      {mode !== "new" && who?.email ? (
        <div className="sa-alert sa-alert-info">
          <Icon name="user" />
          <span>
            {mode === "edit" ? "Editing the application for" : "Applying with your account"} <b>{who.email}</b>.
          </span>
        </div>
      ) : null}

      <form
        className="sa-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (cur === "review") submit();
          else next();
        }}
      >
        {cur === "account" ? (
          <>
            <h2 className="sa-sec-t">
              <Icon name="user" /> Your seller account
            </h2>
            <label className="sa-field">
              <span>Full name</span>
              <input {...inv("name")} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" placeholder="As on your PAN / ID" autoFocus />
              {err("name")}
            </label>
            <div className="sa-row2">
              <label className="sa-field">
                <span>Work email</span>
                <input {...inv("email")} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" placeholder="you@business.in" />
                {err("email") ?? <small>You&apos;ll sign in with this.</small>}
              </label>
              <label className="sa-field">
                <span>Mobile</span>
                <input {...inv("mobile")} inputMode="tel" value={f.mobile} onChange={(e) => set("mobile", e.target.value.replace(/[^\d+ ]/g, ""))} autoComplete="tel" placeholder="98765 43210" />
                {err("mobile") ?? <small>For order alerts and password reset.</small>}
              </label>
            </div>
            <label className="sa-field">
              <span>Password</span>
              <span className="sa-pw">
                <input {...inv("password")} type={showPw ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                  <Icon name={showPw ? "eyeOff" : "eye"} />
                </button>
              </span>
              {err("password") ?? <small>At least 8 characters, with letters and a number.</small>}
            </label>
          </>
        ) : null}

        {cur === "business" ? (
          <>
            <h2 className="sa-sec-t">
              <Icon name="store" /> Your business
            </h2>
            {mode !== "new" ? (
              <div className="sa-row3">
                <label className="sa-field">
                  <span>Contact person</span>
                  <input {...inv("name")} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
                  {err("name")}
                </label>
                <label className="sa-field">
                  <span>Business email</span>
                  <input {...inv("email")} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
                  {err("email")}
                </label>
                <label className="sa-field">
                  <span>Mobile</span>
                  <input {...inv("mobile")} inputMode="tel" value={f.mobile} onChange={(e) => set("mobile", e.target.value.replace(/[^\d+ ]/g, ""))} />
                  {err("mobile")}
                </label>
              </div>
            ) : null}
            <div className="sa-row2">
              <label className="sa-field">
                <span>Legal business name</span>
                <input {...inv("businessName")} value={f.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="As on GST certificate" autoFocus={mode !== "new"} />
                {err("businessName")}
              </label>
              <label className="sa-field">
                <span>Store name</span>
                <input {...inv("displayName")} value={f.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Shown to shoppers" maxLength={60} />
                {err("displayName") ?? <small>“Sold by {f.displayName || "…"}”</small>}
              </label>
            </div>
            <div className="sa-row2">
              <label className="sa-field">
                <span>GSTIN</span>
                <input {...inv("gstin")} value={f.gstin} onChange={(e) => onGstin(e.target.value)} placeholder="27AAPCU1234K1Z0" maxLength={15} autoCapitalize="characters" spellCheck={false} />
                {err("gstin") ?? <small>15 characters. We fill PAN and state from it.</small>}
              </label>
              <label className="sa-field">
                <span>PAN</span>
                <input {...inv("pan")} value={f.pan} onChange={(e) => set("pan", normKyc(e.target.value).slice(0, 10))} placeholder="AAPCU1234K" maxLength={10} autoCapitalize="characters" spellCheck={false} />
                {err("pan") ?? <small>Business PAN (same as in your GSTIN).</small>}
              </label>
            </div>
            <label className="sa-field">
              <span>Pickup / warehouse address</span>
              <input {...inv("addressLine")} value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} autoComplete="street-address" placeholder="Building, street, area" />
              {err("addressLine")}
            </label>
            <div className="sa-row3">
              <label className="sa-field">
                <span>City</span>
                <input {...inv("city")} value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
                {err("city")}
              </label>
              <label className="sa-field">
                <span>State</span>
                <select {...inv("state")} value={f.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Choose…</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {err("state")}
              </label>
              <label className="sa-field">
                <span>PIN code</span>
                <input {...inv("pincode")} inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} autoComplete="postal-code" />
                {err("pincode")}
              </label>
            </div>
            <fieldset className="sa-field" style={{ border: 0 }}>
              <span>Categories you sell</span>
              <div className="sa-checks" role="group" aria-label="Categories">
                {categories.map((c) => (
                  <label key={c.slug} className="sa-check">
                    <input
                      type="checkbox"
                      name="categories"
                      checked={f.categories.includes(c.slug)}
                      onChange={(e) => set("categories", e.target.checked ? [...f.categories, c.slug] : f.categories.filter((x) => x !== c.slug))}
                    />
                    <Icon name="check" />
                    {c.name}
                  </label>
                ))}
              </div>
              {err("categories")}
            </fieldset>
            <div className="sa-field">
              <span>
                Brands you&apos;re authorised to sell <em>(you&apos;ll upload authorisation letters during KYC)</em>
              </span>
              <span className="sa-tagin" aria-invalid={errors.brandsAuthorised ? true : undefined}>
                {f.brandsAuthorised.map((b) => (
                  <span className="sa-tag" key={b}>
                    {b}
                    <button type="button" aria-label={`Remove ${b}`} onClick={() => set("brandsAuthorised", f.brandsAuthorised.filter((x) => x !== b))}>
                      <Icon name="close" />
                    </button>
                  </span>
                ))}
                <input
                  name="brandsAuthorised"
                  value={brandDraft}
                  placeholder={f.brandsAuthorised.length ? "Add another brand…" : "Type a brand and press Enter"}
                  aria-label="Add a brand"
                  onChange={(e) => (e.target.value.endsWith(",") ? addBrand(e.target.value) : setBrandDraft(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addBrand(brandDraft);
                    }
                    if (e.key === "Backspace" && !brandDraft && f.brandsAuthorised.length) set("brandsAuthorised", f.brandsAuthorised.slice(0, -1));
                  }}
                />
              </span>
              {brandSugg.length ? (
                <div className="sa-sugg" aria-label="Brands on The Big Brands">
                  {brandSugg.map((b) => (
                    <button type="button" key={b} onClick={() => addBrand(b)}>
                      + {b}
                    </button>
                  ))}
                </div>
              ) : null}
              {err("brandsAuthorised")}
            </div>
            <label className="sa-field">
              <span>
                About your business <em>(optional)</em>
              </span>
              <textarea name="description" value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={600} placeholder="e.g. Authorised distributor for Beardo and Bella Vita in North India since 2018." />
            </label>
          </>
        ) : null}

        {cur === "bank" ? (
          <>
            <h2 className="sa-sec-t">
              <Icon name="card" /> Where we send your money
            </h2>
            <p className="sa-alt" style={{ textAlign: "left", marginTop: -8 }}>
              Payouts go to this account every Wednesday. It must be in the business&apos;s name.
            </p>
            <label className="sa-field">
              <span>Account holder name</span>
              <input {...inv("bankAccountName")} value={f.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} placeholder={f.businessName || "As per bank records"} autoFocus />
              {err("bankAccountName")}
            </label>
            <div className="sa-row2">
              <label className="sa-field">
                <span>Account number</span>
                <input {...inv("bankAccountNumber")} inputMode="numeric" value={f.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))} autoComplete="off" />
                {err("bankAccountNumber")}
              </label>
              <label className="sa-field">
                <span>Re-enter account number</span>
                <input {...inv("bankAccountConfirm")} inputMode="numeric" value={f.bankAccountConfirm} onChange={(e) => set("bankAccountConfirm", e.target.value.replace(/\D/g, "").slice(0, 18))} autoComplete="off" onPaste={(e) => e.preventDefault()} />
                {err("bankAccountConfirm")}
              </label>
            </div>
            <div className="sa-row2">
              <label className="sa-field">
                <span>IFSC</span>
                <input {...inv("bankIfsc")} value={f.bankIfsc} onChange={(e) => set("bankIfsc", normKyc(e.target.value).slice(0, 11))} placeholder="HDFC0001234" maxLength={11} spellCheck={false} />
                {err("bankIfsc") ?? <small>Printed on your cheque book.</small>}
              </label>
              <label className="sa-field">
                <span>
                  UPI ID <em>(optional)</em>
                </span>
                <input {...inv("upiId")} value={f.upiId} onChange={(e) => set("upiId", e.target.value.trim())} placeholder="business@okhdfcbank" />
                {err("upiId")}
              </label>
            </div>
          </>
        ) : null}

        {cur === "review" ? (
          <>
            <h2 className="sa-sec-t">
              <Icon name="check" /> Review &amp; submit
            </h2>
            <div className="sa-review">
              {mode === "new" ? (
                <div className="sa-rv">
                  <div className="sa-rv-h">
                    Account <button type="button" onClick={() => go(steps.indexOf("account"))}>Edit</button>
                  </div>
                  <dl>
                    <dt>Name</dt>
                    <dd>{f.name}</dd>
                    <dt>Email</dt>
                    <dd>{f.email}</dd>
                    <dt>Mobile</dt>
                    <dd>{f.mobile}</dd>
                  </dl>
                </div>
              ) : null}
              <div className="sa-rv">
                <div className="sa-rv-h">
                  Business <button type="button" onClick={() => go(steps.indexOf("business"))}>Edit</button>
                </div>
                <dl>
                  <dt>Legal name</dt>
                  <dd>{f.businessName}</dd>
                  <dt>Store name</dt>
                  <dd>{f.displayName}</dd>
                  <dt>GSTIN · PAN</dt>
                  <dd>
                    {f.gstin} · {f.pan}
                  </dd>
                  <dt>Pickup address</dt>
                  <dd>
                    {f.addressLine}, {f.city}, {f.state} {f.pincode}
                  </dd>
                  <dt>Categories</dt>
                  <dd>{f.categories.map(catName).join(", ")}</dd>
                  <dt>Brands</dt>
                  <dd>{f.brandsAuthorised.join(", ")}</dd>
                </dl>
              </div>
              <div className="sa-rv">
                <div className="sa-rv-h">
                  Bank <button type="button" onClick={() => go(steps.indexOf("bank"))}>Edit</button>
                </div>
                <dl>
                  <dt>Account</dt>
                  <dd>
                    {f.bankAccountName} · {maskAccount(f.bankAccountNumber)}
                  </dd>
                  <dt>IFSC</dt>
                  <dd>{f.bankIfsc}</dd>
                  {f.upiId ? (
                    <>
                      <dt>UPI</dt>
                      <dd>{f.upiId}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            </div>
            <label className="sa-agree">
              <input type="checkbox" name="acceptTerms" checked={f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} aria-invalid={errors.acceptTerms ? true : undefined} />
              <span>
                I confirm these details are correct, I&apos;m authorised to sell the brands listed, and I agree to the seller terms:{" "}
                <b>12% commission</b> on the selling price, weekly payouts, and only 100% authentic products.
              </span>
            </label>
            {err("acceptTerms")}
          </>
        ) : null}

        <div className="sa-nav">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)} disabled={busy}>
              <Icon name="chevLeft" /> Back
            </button>
          ) : mode === "new" ? (
            <span className="sa-alt" style={{ textAlign: "left" }}>
              Already applied? <SLink href="/seller/login">Sign in</SLink>
            </span>
          ) : null}
          <span className="sa-spacer" />
          <button type="submit" className="btn btn-cart" disabled={busy} style={{ minWidth: 160 }}>
            {cur === "review" ? (busy ? "Submitting…" : mode === "edit" ? "Resubmit application" : "Submit application") : "Continue"}
            {cur !== "review" ? <Icon name="arrow" /> : null}
          </button>
        </div>
      </form>
    </div>
  );
}
