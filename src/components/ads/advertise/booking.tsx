"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AdSlotCard } from "@/server/ads/slots";
import type { BookableBrand, SlotAvailability } from "@/server/ads/advertise";
import type { BookingPayment, BookingView } from "@/server/ads/booking";
import { useStore } from "@/components/cart/cart-context";
import { lum } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { estimateDelivery, GST_RATE, isTimeBased, MAX_CAMPAIGN_DAYS, MIN_LEAD_DAYS, MIN_PERF_BUDGET, quoteBooking, type BookingQuote } from "../lib/pricing";
import { useMediaQuery } from "../client/hooks";
import { CreativePreview } from "./preview";
import { Schematic } from "./schematic";
import { addDays, AV_EVENT, dLabel, flash, fmt, nf, pageName, PV_NOTE, scrollToId, validIso, type AvAct } from "./shared";

type Form = {
  brandId: string;
  company: string;
  email: string;
  gstin: string;
  slot: string;
  start: string;
  end: string;
  budget: number;
  headline: string;
  sub: string;
  cta: string;
  color: string;
  link: string;
  imageUrl: string | null;
  agree: boolean;
};
type Errors = Partial<Record<keyof Form | "form", string>>;
type Booked = { campaign: BookingView; payment: BookingPayment; quote: BookingQuote };

const DRAFT_KEY = "tbb_av_draft";
const LIMITS = { headline: 48, sub: 70, cta: 22 } as const;
const SWATCH_EXTRA = ["#ff3d6e", "#5b35e0", "#0f9f6e", "#140a24", "#f59e0b"];

function defaults(b: BookableBrand) {
  return {
    company: `${b.name} India Pvt Ltd`,
    headline: (b.tagline || `New from ${b.name}`).slice(0, LIMITS.headline),
    sub: "Flat 20% off this week + a free gift with every order",
    cta: `Shop ${b.name}`.slice(0, LIMITS.cta),
    color: b.color,
    link: `/brand/${b.slug}`,
  };
}

export type ApiError = { status: number; code?: string; message: string; fieldErrors?: Record<string, string[]> };
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init, headers: { ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) } });
  const j = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string; details?: { fieldErrors?: Record<string, string[]> } } } | null;
  if (!res.ok) throw { status: res.status, code: j?.error?.code, message: j?.error?.message ?? "Something went wrong — please try again", fieldErrors: j?.error?.details?.fieldErrors } as ApiError;
  return j?.data as T;
}

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: unknown) => void) => void };
  }
}
export function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const FIELD_MAP: Record<string, keyof Form> = { brandId: "brandId", companyName: "company", email: "email", gstin: "gstin", slotCode: "slot", startDate: "start", endDate: "end", budget: "budget", headline: "headline", subline: "sub", ctaLabel: "cta", linkUrl: "link", imageUrl: "imageUrl", agree: "agree" };
const FOCUS_ID: Partial<Record<keyof Form, string>> = { brandId: "av-f-brand", company: "av-f-company", email: "av-f-email", gstin: "av-f-gstin", start: "av-f-start", end: "av-f-end", budget: "av-f-budget", headline: "av-f-headline", cta: "av-f-cta", link: "av-f-link", agree: "av-f-agree" };

export function BookingForm({ slots, brands, availability, aov, today }: { slots: AdSlotCard[]; brands: BookableBrand[]; availability: SlotAvailability[]; aov: number; today: string }) {
  const { user, ready } = useStore();
  const bookable = useMemo(() => slots.filter((s) => s.bookable), [slots]);
  const first = brands.find((b) => b.slug === "mamaearth") ?? brands[0];
  const minStart = addDays(today, MIN_LEAD_DAYS);
  const [F, setF] = useState<Form>(() => {
    const st = addDays(today, 3);
    return { brandId: first?.id ?? "", ...defaults(first), email: "", gstin: "", slot: bookable[0]?.code ?? "H1", start: st, end: addDays(st, 6), budget: 25000, imageUrl: null, agree: false };
  });
  const [touched, setTouched] = useState<Set<keyof Form>>(new Set());
  const [errors, setErrors] = useState<Errors>({});
  const narrow = useMediaQuery("(max-width: 639px)");
  const [viewChoice, setView] = useState<"desktop" | "mobile" | null>(null);
  const view = viewChoice ?? (narrow ? "mobile" : "desktop");
  const [busy, setBusy] = useState<"" | "submit" | "pay" | "upload">("");
  const [booked, setBooked] = useState<Booked | null>(null);
  const [paid, setPaid] = useState<BookingView | null>(null);
  const [payError, setPayError] = useState("");
  const [needLogin, setNeedLogin] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const brand = brands.find((b) => b.id === F.brandId) ?? first;
  const slot = bookable.find((s) => s.code === F.slot) ?? bookable[0];
  const avail = availability.find((a) => a.code === F.slot);
  const days = validIso(F.start) && validIso(F.end) && F.end >= F.start ? Math.round((Date.parse(F.end) - Date.parse(F.start)) / 864e5) + 1 : 0;
  const timeBased = slot ? isTimeBased(slot.pricingModel) : true;

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setF((f) => ({ ...f, [k]: v }));
    setTouched((t) => new Set(t).add(k));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  }, []);

  const changeBrand = (id: string) => {
    const nb = brands.find((b) => b.id === id);
    if (!nb) return;
    const oldD = defaults(brand);
    const newD = defaults(nb);
    setF((f) => {
      const next = { ...f, brandId: id };
      (Object.keys(newD) as (keyof typeof newD)[]).forEach((k) => {
        // replace fields the advertiser hasn't customised (or that still hold the old brand's default)
        if (!touched.has(k) || String(f[k]).toLowerCase() === String(oldD[k]).toLowerCase()) next[k] = newD[k];
      });
      return next;
    });
    setErrors({});
  };

  const pick = useCallback(
    (code: string, d?: number) => {
      const s = bookable.find((x) => x.code === code);
      if (!s) return;
      setBooked(null);
      setPaid(null);
      setF((f) => ({ ...f, slot: code, end: d && validIso(f.start) ? addDays(f.start, Math.min(MAX_CAMPAIGN_DAYS, Math.round(d)) - 1) : f.end }));
      scrollToId("av-book");
      setTimeout(() => flash("av-stage"), 350);
      toast(`${s.name} selected. Write your ad and preview it live`, { icon: "megaphone" });
    },
    [bookable],
  );

  // actions from the rate card / formats / estimator, deep links, and a draft saved before signing in
  useEffect(() => {
    const onAct = (e: Event) => {
      const a = (e as CustomEvent<AvAct>).detail;
      if (a?.type === "pick") pick(a.slot, a.days);
    };
    window.addEventListener(AV_EVENT, onAct);
    const restore = setTimeout(() => {
    const qs = new URLSearchParams(location.search);
    let draft: Form | null = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw) as Form;
    } catch {
      /* storage blocked */
    }
    if (draft && brands.some((b) => b.id === draft!.brandId)) {
      setF((f) => ({ ...f, ...draft, agree: false }));
      setTouched(new Set(["company", "headline", "sub", "cta", "color", "link"]));
      setTimeout(() => scrollToId("av-book"), 150);
    } else {
      const s = qs.get("slot")?.toUpperCase();
      if (s && bookable.some((x) => x.code === s)) {
        setF((f) => ({ ...f, slot: s }));
        setTimeout(() => scrollToId("av-book"), 150);
      } else if (qs.has("book") || location.hash === "#av-book") setTimeout(() => scrollToId("av-book"), 150);
      else if (qs.has("rates") || location.hash === "#av-ratecard") setTimeout(() => scrollToId("av-ratecard"), 150);
    }
    }, 0);
    return () => {
      window.removeEventListener(AV_EVENT, onAct);
      clearTimeout(restore);
    };
  }, [pick, brands, bookable]);

  // ── availability (next 14 days from the earliest start) ──
  const dayCells = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const iso = addDays(minStart, i);
      const booked = avail?.days.find((d) => d.date === iso)?.booked ?? 0;
      const positions = avail?.positions ?? slot?.positions ?? 1;
      const exclusive = avail?.exclusive ?? timeBased;
      const left = exclusive ? Math.max(0, positions - booked) : null;
      return { iso, left, positions, sold: left === 0, hot: left !== null ? left <= Math.max(1, Math.floor(positions / 3)) : false };
    });
  }, [avail, minStart, slot, timeBased]);

  const soldDays = useMemo(() => {
    if (!avail?.exclusive || !days) return [] as string[];
    const out: string[] = [];
    for (let d = F.start; d <= F.end; d = addDays(d, 1)) {
      const b = avail.days.find((x) => x.date === d)?.booked ?? 0;
      if (b >= avail.positions) out.push(d);
      if (out.length > 90) break;
    }
    return out;
  }, [avail, days, F.start, F.end]);
  const nextFree = useMemo(() => {
    if (!avail?.exclusive) return null;
    const need = Math.max(1, days || 7);
    for (let i = 0; i < avail.days.length - need; i++) {
      const win = avail.days.slice(i, i + need);
      if (win[0].date >= minStart && win.every((d) => d.booked < avail.positions)) return win[0].date;
    }
    return null;
  }, [avail, days, minStart]);

  // untouched dates jump to the first window that is actually available for the chosen placement
  const shiftKey = `${F.slot}|${nextFree}`;
  const [shifted, setShifted] = useState("");
  if (!touched.has("start") && !touched.has("end") && nextFree && soldDays.length && shifted !== shiftKey) {
    setShifted(shiftKey);
    setF((f) => ({ ...f, start: nextFree, end: addDays(nextFree, Math.max(1, days || 7) - 1) }));
  }

  // ── money ──
  const q = slot && days ? quoteBooking(slot, days, timeBased ? 0 : F.budget) : null;
  const est = slot && q ? estimateDelivery(slot, slot.reach, timeBased ? q.run : Math.max(1, q.net / Math.max(1, estimateDelivery(slot, slot.reach, 1, 0, aov).perDay)), q.net, aov) : null;
  const perfDays = slot && q && !timeBased ? Math.min(days, Math.max(1, Math.round(q.net / Math.max(1, estimateDelivery(slot, slot.reach, 1, 0, aov).perDay)))) : 0;

  const swatches = useMemo(() => {
    const list = [brand.color, brand.accent && lum(brand.accent) < 0.7 ? brand.accent : null, ...SWATCH_EXTRA].filter(Boolean).map((c) => (c as string).toLowerCase());
    return [...new Set(list)].slice(0, 6);
  }, [brand]);

  function validate(): Errors {
    const e: Errors = {};
    if (!brand) e.brandId = "Choose your brand";
    if (F.company.trim().length < 2) e.company = "Enter the company that will be invoiced";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(F.email.trim())) e.email = "Enter a work email for approvals and the GST invoice";
    if (F.gstin.trim() && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(F.gstin.trim().toUpperCase())) e.gstin = "Enter a valid 15-character GSTIN";
    if (F.headline.trim().length < 3) e.headline = "Write a headline (at least 3 characters)";
    if (F.cta.trim().length < 2) e.cta = "Add button text, e.g. “Shop now”";
    if (F.link.trim() && !/^\/(?!\/)[^\s\\]*$/.test(F.link.trim()) && !/^https:\/\/[^\s]+\.[a-z]{2,}/i.test(F.link.trim())) e.link = "Use a store path like /brand/plum or an https:// link";
    if (!validIso(F.start)) e.start = "Choose a start date";
    else if (F.start < minStart) e.start = `Earliest start is ${dLabel(minStart)} (we need a day to review)`;
    else if (soldDays.length) e.start = `Sold out on ${soldDays.length} of these days${nextFree ? ` — next free start ${dLabel(nextFree)}` : ""}`;
    if (!validIso(F.end)) e.end = "Choose an end date";
    else if (validIso(F.start) && F.end < F.start) e.end = "End date must be on or after the start date";
    else if (days > MAX_CAMPAIGN_DAYS) e.end = `Campaigns can run up to ${MAX_CAMPAIGN_DAYS} days. Contact us for longer`;
    if (!timeBased && (!Number.isFinite(F.budget) || F.budget < MIN_PERF_BUDGET)) e.budget = `Minimum budget is ${fmt(MIN_PERF_BUDGET)}`;
    if (!F.agree) e.agree = "Please confirm the ad follows our guidelines";
    return e;
  }

  function focusFirst(e: Errors) {
    const order: (keyof Form)[] = ["brandId", "company", "email", "gstin", "start", "end", "budget", "headline", "cta", "link", "agree"];
    const k = order.find((x) => e[x]);
    const el = k && FOCUS_ID[k] ? document.getElementById(FOCUS_ID[k]!) : null;
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const saveDraft = () => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...F, agree: false }));
    } catch {
      /* storage blocked */
    }
  };
  const loginHref = `/login?next=${encodeURIComponent("/advertise?book=1")}`;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const e = validate();
    setErrors(e);
    const keys = Object.keys(e).filter((k) => e[k as keyof Errors]);
    if (keys.length) {
      focusFirst(e);
      toast(keys.length === 1 ? e[keys[0] as keyof Errors]! : `Please fix ${keys.length} highlighted fields`, { icon: "info" });
      return;
    }
    if (ready && !user) {
      saveDraft();
      setNeedLogin(true);
      return;
    }
    setBusy("submit");
    try {
      const res = await api<Booked>("/api/v1/ads/book", {
        method: "POST",
        body: JSON.stringify({
          slotCode: F.slot,
          brandId: F.brandId,
          companyName: F.company.trim(),
          email: F.email.trim(),
          gstin: F.gstin.trim() || undefined,
          headline: F.headline.trim(),
          subline: F.sub.trim() || undefined,
          ctaLabel: F.cta.trim(),
          linkUrl: F.link.trim() || undefined,
          color: F.color,
          imageUrl: F.imageUrl || undefined,
          startDate: F.start,
          endDate: F.end,
          budget: timeBased ? 0 : Math.round(F.budget),
          agree: true,
        }),
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setBooked(res);
      setPayError("");
      scrollToId("av-book");
      toast(`Campaign ${res.campaign.code} created — complete the payment to submit it for review`, { icon: "megaphone" });
    } catch (x) {
      const er = x as ApiError;
      if (er.status === 401) {
        saveDraft();
        setNeedLogin(true);
        return;
      }
      const fe: Errors = {};
      Object.entries(er.fieldErrors ?? {}).forEach(([k, v]) => {
        const key = FIELD_MAP[k];
        if (key && v?.[0]) fe[key] = v[0];
      });
      if (er.status === 409) fe.start = er.message;
      if (!Object.keys(fe).length) fe.form = er.message;
      setErrors(fe);
      focusFirst(fe);
      toast(er.message, { icon: "info" });
    } finally {
      setBusy("");
    }
  }

  async function verify(body: Record<string, unknown>) {
    if (!booked) return;
    setBusy("pay");
    setPayError("");
    try {
      const v = await api<BookingView>(`/api/v1/ads/book/${encodeURIComponent(booked.campaign.code)}/pay/verify`, { method: "POST", body: JSON.stringify(body) });
      setPaid(v);
      scrollToId("av-book");
      toast(`Paid — ${v.code} is with our team for review`, { icon: "check" });
    } catch (x) {
      const er = x as ApiError;
      setPayError(er.message);
      // a failed attempt needs a fresh gateway order for the next try
      try {
        const v = await api<BookingView>(`/api/v1/ads/book/${encodeURIComponent(booked.campaign.code)}/pay`, { method: "POST" });
        if (v.payment) setBooked({ ...booked, campaign: v, payment: v.payment });
      } catch {
        /* keep the current order */
      }
    } finally {
      setBusy("");
    }
  }

  async function payRazorpay() {
    if (!booked) return;
    setBusy("pay");
    const ok = await loadRazorpay();
    setBusy("");
    if (!ok || !window.Razorpay) {
      setPayError("Couldn't load the payment window. Check your connection and try again.");
      return;
    }
    const p = booked.payment;
    const rz = new window.Razorpay({
      key: p.keyId,
      amount: Math.round(p.amount * 100),
      currency: p.currency,
      order_id: p.providerOrderId,
      name: "The Big Brands · Ads",
      description: `${booked.campaign.code} · ${booked.campaign.slot.name}`,
      prefill: { email: F.email },
      notes: { campaign: booked.campaign.code },
      theme: { color: "#ff3d6e" },
      handler: (r: Record<string, string>) => void verify({ razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }),
      modal: { ondismiss: () => setPayError("Payment window closed — your campaign is saved. Pay whenever you're ready.") },
    });
    rz.on("payment.failed", () => setPayError("Payment failed — no money was taken. Try again or use another method."));
    rz.open();
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) return toast("Upload a JPG, PNG, WEBP, AVIF or GIF image", { icon: "info" });
    if (file.size > 5 * 1024 * 1024) return toast("Images must be 5 MB or smaller", { icon: "info" });
    if (ready && !user) {
      saveDraft();
      setNeedLogin(true);
      return;
    }
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("alt", `${brand.name} creative`);
      const m = await api<{ url: string }>("/api/v1/ads/media", { method: "POST", body: fd });
      set("imageUrl", m.url);
      toast("Banner uploaded — check the preview", { icon: "upload" });
    } catch (x) {
      const er = x as ApiError;
      if (er.status === 401) {
        saveDraft();
        setNeedLogin(true);
      } else toast(er.message, { icon: "info" });
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const bookAnother = () => {
    setBooked(null);
    setPaid(null);
    setPayError("");
    setF((f) => ({ ...f, agree: false, imageUrl: null }));
    scrollToId("av-book");
  };

  if (!slot || !brand) return <p className="av-sum-bad">Self-serve booking is not available right now.</p>;
  const previewInput = { brand, products: brand.products, headline: F.headline, sub: F.sub, cta: F.cta, color: F.color, imageUrl: F.imageUrl };
  const err = (k: keyof Errors) =>
    errors[k] ? (
      <span className="av-err" id={`av-err-${k}`} role="alert">
        <Icon name="info" />
        {errors[k]}
      </span>
    ) : null;
  const inv = (k: keyof Form) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `av-err-${k}` } : {});

  // ───────────── success ─────────────
  if (booked && paid) {
    const c = paid;
    return (
      <div className="av-ok" role="status">
        <div className="av-ok-main">
          <span className="av-ok-ic">
            <Icon name="check" />
          </span>
          <span className="av-eyebrow">Paid &amp; submitted</span>
          <h3>
            Submitted for review — <span className="av-ok-id">{c.code}</span>
          </h3>
          <p>
            Our team checks your creative within 24 hours. Once approved it goes live in <b>{c.slot.code} · {c.slot.name}</b> on {dLabel(c.startDate)}. If we can&rsquo;t approve it, you get a full refund.
          </p>
          <ol className="av-ok-steps">
            <li className="done">
              <i>
                <Icon name="check" />
              </i>
              <b>Booked &amp; paid</b>
              <small>Today · {fmt(c.payment?.amount ?? 0)}</small>
            </li>
            <li className="now">
              <i>
                <Icon name="clock" />
              </i>
              <b>Creative review</b>
              <small>within 24 hours</small>
            </li>
            <li>
              <i>
                <Icon name="zap" />
              </i>
              <b>Goes live</b>
              <small>{dLabel(c.startDate)}</small>
            </li>
            <li>
              <i>
                <Icon name="chart" />
              </i>
              <b>Live reporting</b>
              <small>impressions &amp; clicks</small>
            </li>
          </ol>
          <div className="av-ok-btns">
            <Link className="btn btn-cart btn-lg" href="/advertise/campaigns">
              <Icon name="sliders" />
              My campaigns
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/">
              Back to the store
            </Link>
            <button type="button" className="btn btn-ghost btn-lg" onClick={bookAnother}>
              <Icon name="plus" />
              Book another
            </button>
          </div>
        </div>
        <div className="av-ok-card">
          <div className="av-ok-pv">
            <CreativePreview slot={c.slot.code} f={previewInput} mobile={false} firstName={user?.firstName} today={today} />
          </div>
          <dl className="av-sum-l">
            <div>
              <dt>Advertiser</dt>
              <dd>{F.company}</dd>
            </div>
            <div>
              <dt>Placement</dt>
              <dd>
                {c.slot.code} · {c.slot.name}
              </dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                {dLabel(c.startDate)} → {dLabel(c.endDate)}
              </dd>
            </div>
            <div>
              <dt>Media (excl. GST)</dt>
              <dd>{fmt(c.quote?.net ?? 0)}</dd>
            </div>
            <div className="av-sum-t">
              <dt>Paid incl. GST</dt>
              <dd>{fmt(c.payment?.amount ?? 0)}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  // ───────────── payment ─────────────
  if (booked) {
    const p = booked.payment;
    const bq = booked.quote;
    return (
      <div className="av-ok av-payrow">
        <div className="av-ok-main">
          <span className="av-eyebrow">Step 2 of 2 · Payment</span>
          <h3>
            Pay to submit <span className="av-ok-id">{booked.campaign.code}</span>
          </h3>
          <p>
            Your campaign is saved. Pay now and it goes to our team for review — approved ads go live on {dLabel(booked.campaign.startDate)}. Full refund if we can&rsquo;t approve it.
          </p>
          {p.mode === "TEST" ? (
            <div className="av-tgw" role="group" aria-label="Test payment gateway">
              <div className="av-tgw-h">
                <span className="av-tgw-logo">
                  <Icon name="shield" />
                  Test payment gateway
                </span>
                <span className="av-tgw-tag">No real money moves</span>
              </div>
              <div className="av-tgw-amt">
                <small>Amount payable</small>
                <b>{fmt(p.amount)}</b>
                <span>
                  {booked.campaign.code} · order {p.providerOrderId}
                </span>
              </div>
              <div className="av-tgw-btns">
                <button type="button" className="btn btn-cart btn-lg" disabled={busy === "pay"} onClick={() => void verify({ test: true, outcome: "success" })}>
                  {busy === "pay" ? "Processing…" : `Pay ${fmt(p.amount)}`}
                  <Icon name="arrow" />
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy === "pay"} onClick={() => void verify({ test: true, outcome: "failure" })}>
                  Simulate a failed payment
                </button>
              </div>
              <p className="av-tgw-note">
                <Icon name="info" />
                Razorpay (UPI, cards, net banking) switches on automatically once the live keys are added.
              </p>
            </div>
          ) : (
            <div className="av-ok-btns">
              <button type="button" className="btn btn-cart btn-lg" disabled={busy === "pay"} onClick={() => void payRazorpay()}>
                <Icon name="card" />
                {busy === "pay" ? "Opening…" : `Pay ${fmt(p.amount)} securely`}
              </button>
            </div>
          )}
          {payError ? (
            <p className="av-sum-bad" role="alert">
              <Icon name="info" />
              {payError}
            </p>
          ) : null}
          <p className="av-pay">
            <Icon name="shield" />
            UPI, cards and net banking via Razorpay · GST invoice to {F.email || "your email"}
          </p>
          <Link className="link" href="/advertise/campaigns">
            Pay later — it&rsquo;s saved in My campaigns <Icon name="arrow" />
          </Link>
        </div>
        <div className="av-ok-card">
          <div className="av-ok-pv">
            <CreativePreview slot={booked.campaign.slot.code} f={previewInput} mobile={false} firstName={user?.firstName} today={today} />
          </div>
          <dl className="av-sum-l">
            <div>
              <dt>Placement</dt>
              <dd>
                {booked.campaign.slot.code} · {booked.campaign.slot.name}
              </dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                {dLabel(booked.campaign.startDate)} → {dLabel(booked.campaign.endDate)}
                <small>
                  {bq.run} day{bq.run > 1 ? "s" : ""}
                </small>
              </dd>
            </div>
            <div>
              <dt>Media cost</dt>
              <dd>{fmt(bq.gross)}</dd>
            </div>
            {bq.discount ? (
              <div className="av-sum-disc">
                <dt>Volume discount ({bq.discountPct * 100}%)</dt>
                <dd>−{fmt(bq.discount)}</dd>
              </div>
            ) : null}
            <div>
              <dt>GST @ 18%</dt>
              <dd>{fmt(bq.gst)}</dd>
            </div>
            <div className="av-sum-t">
              <dt>Total payable</dt>
              <dd>{fmt(bq.total)}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  // ───────────── form ─────────────
  return (
    <form className="av-bk-grid" noValidate aria-label="Book a campaign" onSubmit={submit}>
      <div className="av-bk-f">
        <fieldset className="av-step">
          <legend>
            <i>1</i>Advertiser
          </legend>
          <div className="av-row2">
            <label className="av-fld">
              <span>Brand</span>
              <select id="av-f-brand" value={F.brandId} onChange={(e) => changeBrand(e.target.value)} {...inv("brandId")}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {err("brandId")}
            </label>
            <label className="av-fld">
              <span>Advertiser company</span>
              <input id="av-f-company" type="text" autoComplete="organization" maxLength={80} value={F.company} placeholder="e.g. Himalaya Wellness Pvt Ltd" onChange={(e) => set("company", e.target.value)} {...inv("company")} />
              {err("company")}
            </label>
          </div>
          <div className="av-row2">
            <label className="av-fld">
              <span>Work email</span>
              <input id="av-f-email" type="email" autoComplete="email" maxLength={120} value={F.email} placeholder="you@brand.com" onChange={(e) => set("email", e.target.value)} {...inv("email")} />
              {err("email")}
            </label>
            <label className="av-fld">
              <span>
                GSTIN <em className="av-cnt">optional</em>
              </span>
              <input id="av-f-gstin" type="text" maxLength={15} value={F.gstin} placeholder="27AAAAA0000A1Z5" onChange={(e) => set("gstin", e.target.value.toUpperCase())} {...inv("gstin")} />
              {err("gstin")}
            </label>
          </div>
        </fieldset>

        <fieldset className="av-step">
          <legend>
            <i>2</i>Placement &amp; dates
          </legend>
          <div className="av-slots" role="radiogroup" aria-label="Placement">
            {bookable.map((x) => (
              <label key={x.code} className={F.slot === x.code ? "av-st on" : "av-st"}>
                <input type="radio" id={`av-st-${x.code}`} name="av-slot" value={x.code} checked={F.slot === x.code} onChange={() => set("slot", x.code)} />
                <span className="av-st-in">
                  <span className="av-id">{x.code}</span>
                  <span className="av-st-t">
                    <b>{x.name}</b>
                    <small>
                      {pageName(x.page)} · {x.size}
                    </small>
                  </span>
                  <em>{x.rateLabel}</em>
                </span>
              </label>
            ))}
          </div>
          <div className="av-row2 av-dates">
            <label className="av-fld">
              <span>Start date</span>
              <input
                id="av-f-start"
                type="date"
                min={minStart}
                value={F.start}
                onChange={(e) => {
                  const v = e.target.value;
                  setF((f) => {
                    const d = validIso(f.start) && validIso(f.end) && f.end >= f.start ? Math.round((Date.parse(f.end) - Date.parse(f.start)) / 864e5) + 1 : 7;
                    return { ...f, start: v, end: validIso(v) ? addDays(v, d - 1) : f.end };
                  });
                  setErrors((er) => ({ ...er, start: undefined, end: undefined }));
                  setTouched((t) => new Set(t).add("start"));
                }}
                {...inv("start")}
              />
              {err("start")}
            </label>
            <label className="av-fld">
              <span>End date</span>
              <input id="av-f-end" type="date" min={validIso(F.start) ? F.start : minStart} value={F.end} onChange={(e) => set("end", e.target.value)} {...inv("end")} />
              {err("end")}
            </label>
          </div>
          <div className="av-durs" role="group" aria-label="Quick duration">
            {[3, 7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                className={days === d ? "chip on" : "chip"}
                aria-pressed={days === d}
                onClick={() => {
                  setF((f) => ({ ...f, start: validIso(f.start) ? f.start : addDays(today, 3), end: addDays(validIso(f.start) ? f.start : addDays(today, 3), d - 1) }));
                  setErrors((er) => ({ ...er, end: undefined, start: undefined }));
                }}
              >
                {d} days
                {d >= 14 && slot.pricingModel === "DAY" ? <small>−{d >= 30 ? 15 : 10}%</small> : null}
              </button>
            ))}
          </div>
          {!timeBased ? (
            <label className="av-fld">
              <span>
                Campaign budget <em className="av-cnt">excl. GST · billed on delivery</em>
              </span>
              <input id="av-f-budget" type="number" inputMode="numeric" min={MIN_PERF_BUDGET} step={1000} value={Number.isFinite(F.budget) ? F.budget : ""} onChange={(e) => set("budget", Number(e.target.value))} {...inv("budget")} />
              <div className="av-chips">
                {[10000, 25000, 50000, 100000].map((v) => (
                  <button key={v} type="button" className={F.budget === v ? "chip on" : "chip"} onClick={() => set("budget", v)}>
                    {fmt(v)}
                  </button>
                ))}
              </div>
              {err("budget")}
            </label>
          ) : null}
          <div className="av-avail">
            <div className="av-av-h">
              <span>Availability · next 14 days</span>
              <span className="av-av-k">
                <i className="k-open" />
                Open <i className="k-hot" />
                Filling fast <i className="k-sold" />
                Sold out
              </span>
            </div>
            <div className="av-av-g">
              {dayCells.map((c) => {
                const inR = days > 0 && c.iso >= F.start && c.iso <= F.end;
                const txt = c.left === null ? "Open" : c.sold ? "Sold out" : `${c.left}/${c.positions} left`;
                const cls = ["av-day", c.sold && "sold", !c.sold && c.hot && "hot", inR && "in", c.iso === F.start && "s0", c.iso === F.end && "s1"].filter(Boolean).join(" ");
                const wk = new Date(`${c.iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
                return (
                  <button
                    key={c.iso}
                    type="button"
                    className={cls}
                    aria-pressed={inR}
                    aria-label={`Start on ${dLabel(c.iso)}, ${txt}`}
                    onClick={() => {
                      const d = Math.max(1, days || 7);
                      setF((f) => ({ ...f, start: c.iso, end: addDays(c.iso, d - 1) }));
                      setErrors((er) => ({ ...er, start: undefined, end: undefined }));
                      setTouched((t) => new Set(t).add("start"));
                    }}
                  >
                    <small>{wk}</small>
                    <b>{Number(c.iso.slice(8))}</b>
                    <i>{c.left === null ? "Open" : c.sold ? "Full" : `${c.left} left`}</i>
                  </button>
                );
              })}
            </div>
            {soldDays.length ? (
              <p className="av-av-note">
                <Icon name="info" />
                {slot.name} is fully booked on {soldDays.length} of your days.
                {nextFree ? (
                  <button type="button" className="link" onClick={() => setF((f) => ({ ...f, start: nextFree, end: addDays(nextFree, Math.max(1, days || 7) - 1) }))}>
                    Start {dLabel(nextFree)} instead
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>
        </fieldset>

        <fieldset className="av-step">
          <legend>
            <i>3</i>Creative
          </legend>
          <label className="av-fld">
            <span>
              Headline{" "}
              <em className="av-cnt">
                {F.headline.length}/{LIMITS.headline}
              </em>
            </span>
            <input id="av-f-headline" type="text" maxLength={LIMITS.headline} value={F.headline} onChange={(e) => set("headline", e.target.value)} {...inv("headline")} />
            {err("headline")}
          </label>
          <label className="av-fld">
            <span>
              Sub-line{" "}
              <em className="av-cnt">
                {F.sub.length}/{LIMITS.sub}
              </em>
            </span>
            <input id="av-f-sub" type="text" maxLength={LIMITS.sub} value={F.sub} placeholder="Offer or proof point, e.g. Flat 20% off this week" onChange={(e) => set("sub", e.target.value)} />
          </label>
          <div className="av-row2">
            <label className="av-fld">
              <span>
                Button text{" "}
                <em className="av-cnt">
                  {F.cta.length}/{LIMITS.cta}
                </em>
              </span>
              <input id="av-f-cta" type="text" maxLength={LIMITS.cta} value={F.cta} onChange={(e) => set("cta", e.target.value)} {...inv("cta")} />
              {err("cta")}
            </label>
            <div className="av-fld">
              <span id="av-col-l">Brand colour</span>
              <div className="av-colors" role="group" aria-labelledby="av-col-l">
                <label className="av-col-pick" title="Pick any colour">
                  <input type="color" value={F.color} aria-label="Pick a custom brand colour" onChange={(e) => set("color", e.target.value)} />
                  <span style={{ background: F.color }} />
                </label>
                {swatches.map((c) => (
                  <button key={c} type="button" className={c === F.color.toLowerCase() ? "av-sw on" : "av-sw"} style={{ background: c }} aria-label={`Use colour ${c}`} aria-pressed={c === F.color.toLowerCase()} onClick={() => set("color", c)} />
                ))}
                <code>{F.color.toUpperCase()}</code>
              </div>
            </div>
          </div>
          <label className="av-fld">
            <span>
              Landing page <em className="av-cnt">store path or https:// link</em>
            </span>
            <input id="av-f-link" type="text" maxLength={300} value={F.link} placeholder={`/brand/${brand.slug}`} onChange={(e) => set("link", e.target.value)} {...inv("link")} />
            {err("link")}
          </label>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
          {F.imageUrl ? (
            <div className="av-upload av-upload-on">
              {/* eslint-disable-next-line @next/next/no-img-element -- just-uploaded creative thumbnail */}
              <img src={F.imageUrl} alt="Uploaded banner" />
              <span>
                <b>Banner uploaded</b> — shown in the preview. It&rsquo;s reviewed with your ad.
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("imageUrl", null)}>
                Remove
              </button>
            </div>
          ) : (
            <button type="button" className="av-upload" disabled={busy === "upload"} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" />
              <span>
                {busy === "upload" ? (
                  <b>Uploading…</b>
                ) : (
                  <>
                    <b>Have a finished banner or photo?</b> Upload a JPG, PNG or WEBP (≤ 5 MB) at {slot.size}
                  </>
                )}
              </span>
            </button>
          )}
        </fieldset>
      </div>

      <aside className="av-bk-side">
        <div className="av-pv">
          <div className="av-pv-h">
            <b>
              <Icon name="eye" />
              Live preview
            </b>
            <div className="av-seg av-seg-sm" role="radiogroup" aria-label="Preview device">
              <button type="button" role="radio" aria-checked={view !== "mobile"} onClick={() => setView("desktop")}>
                Desktop
              </button>
              <button type="button" role="radio" aria-checked={view === "mobile"} onClick={() => setView("mobile")}>
                <Icon name="phone" />
                Mobile
              </button>
            </div>
          </div>
          <div className="av-stage" id="av-stage">
            <div className={view === "mobile" ? "av-dev is-m" : "av-dev"}>
              <div className="av-dev-in">
                <CreativePreview slot={F.slot} f={previewInput} mobile={view === "mobile"} firstName={user?.firstName} today={today} />
              </div>
            </div>
          </div>
          <div className="av-pv-note">
            <span className="av-pv-sx">
              <Schematic code={slot.code} />
            </span>
            <span>
              Appears in{" "}
              <b>
                {slot.code} · {slot.name}
              </b>
              : {PV_NOTE[slot.code] ?? slot.format}.
            </span>
          </div>
        </div>

        <div className="av-sum" aria-live="polite">
          <div className="av-sum-h">
            <b>Cost summary</b>
            <span className="av-id">{slot.code}</span>
          </div>
          {!q ? (
            <p className="av-sum-bad">
              <Icon name="info" />
              Choose an end date on or after the start date.
            </p>
          ) : (
            <>
              <dl className="av-sum-l">
                <div>
                  <dt>Placement</dt>
                  <dd>{slot.name}</dd>
                </div>
                <div>
                  <dt>Dates</dt>
                  <dd>
                    {dLabel(F.start)} → {dLabel(timeBased && q.run > days ? addDays(F.start, q.run - 1) : F.end)}
                    <small>
                      {timeBased ? q.run : days} day{(timeBased ? q.run : days) > 1 ? "s" : ""}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <dd>{slot.rateLabel}</dd>
                </div>
                <div>
                  <dt>
                    {timeBased ? (
                      <>
                        Media cost{" "}
                        <small>
                          {q.units} × {fmt(slot.rate)}
                        </small>
                      </>
                    ) : (
                      <>
                        Media budget <small>billed on delivery, capped here</small>
                      </>
                    )}
                  </dt>
                  <dd>{fmt(q.gross)}</dd>
                </div>
                {q.discount ? (
                  <div className="av-sum-disc">
                    <dt>Volume discount ({q.discountPct * 100}%)</dt>
                    <dd>−{fmt(q.discount)}</dd>
                  </div>
                ) : slot.pricingModel === "DAY" && days < 14 ? (
                  <div className="av-sum-tip">
                    <dt>
                      <Icon name="percent" />
                      Book {14 - days} more day{14 - days > 1 ? "s" : ""} to save 10%
                    </dt>
                    <dd />
                  </div>
                ) : null}
                <div>
                  <dt>GST @ {GST_RATE * 100}%</dt>
                  <dd>{fmt(q.gst)}</dd>
                </div>
                <div className="av-sum-t">
                  <dt>Total payable</dt>
                  <dd>{fmt(q.total)}</dd>
                </div>
              </dl>
              {est ? (
                <p className="av-sum-est">
                  <Icon name="trending" />
                  <span>
                    Est. <b>~{nf(est.imp)}</b> {slot.reach.impL.toLowerCase()} · <b>~{nf(est.clicks)}</b> {slot.reach.clkL.toLowerCase()} · <b>~{nf(est.orders)}</b> orders
                    {!timeBased && perfDays ? ` · budget lasts ≈ ${perfDays} day${perfDays > 1 ? "s" : ""}` : ""}
                  </span>
                </p>
              ) : null}
              {!slot.isActive ? (
                <p className="av-sum-note warn">
                  <Icon name="info" />
                  This slot is paused right now. Your campaign starts once it&rsquo;s switched back on.
                </p>
              ) : null}
            </>
          )}
        </div>
        <label className="av-agree">
          <input id="av-f-agree" type="checkbox" checked={F.agree} onChange={(e) => set("agree", e.target.checked)} {...inv("agree")} />
          <span>I confirm this ad follows The Big Brands ad guidelines: ASCI-compliant, no unverified medical claims, and the products are listed on the store.</span>
        </label>
        {err("agree")}
        {errors.form ? (
          <p className="av-sum-bad" role="alert">
            <Icon name="info" />
            {errors.form}
          </p>
        ) : null}
        {needLogin ? (
          <div className="av-login" role="alert">
            <Icon name="user" />
            <span>
              <b>Sign in to book.</b> Your ad is saved — we&rsquo;ll bring you right back here. New to The Big Brands? Signing in with your mobile number creates your account.
            </span>
            <Link className="btn btn-dark btn-sm" href={loginHref} onClick={saveDraft}>
              Sign in
            </Link>
          </div>
        ) : null}
        <button type="submit" className="btn btn-cart btn-lg av-submit" disabled={busy === "submit"}>
          {busy === "submit" ? "Saving your campaign…" : q ? `Continue to payment · ${fmt(q.total)}` : "Continue to payment"}
          <Icon name="arrow" />
        </button>
        <p className="av-pay">
          <Icon name="shield" />
          Pay securely by UPI, card or net banking · full refund if your ad isn&rsquo;t approved
        </p>
      </aside>
    </form>
  );
}
