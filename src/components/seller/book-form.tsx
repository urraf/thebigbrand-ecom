"use client";
/**
 * Book a sponsored-product campaign: product → placement → dates & budget → keywords → pay.
 * POST /api/v1/seller/ads (validates seller rules, then books via the ads area's POST /api/v1/ads/book).
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, ApiFailure, errorText } from "./api";
import { PayPanel } from "./pz-pay-panel";
import type { GatewayPayment } from "./pz-pay";
import { Thumb } from "./thumb";
import { useSellerHref } from "./use-seller-href";
import { fmtDate } from "./format";

type Product = { id: string; name: string; brand: string; price: number; stock: number; image: { url: string; alt: string | null } | null; art: { shape: string | null; c1: string | null; c2: string | null } };
type Slot = { code: string; name: string; rate: number; isActive: boolean; pricingModel: string };

type Props = {
  products: Product[];
  slots: Slot[];
  /** IST dates as YYYY-MM-DD */
  minStart: string;
  defaultEnd: string;
  preselect?: string;
  prefill: { name?: string; email?: string; contact?: string };
};

const SLOT_COPY: Record<string, { title: string; where: string }> = {
  S3: { title: "Search results", where: "Your product appears as a Sponsored card among the top results when shoppers search related terms." },
  P1: { title: "Product pages", where: "Shown in “Related sponsored products” on similar product pages — high intent shoppers comparing options." },
};

const MIN_BUDGET = 5000;
const GST = 0.18;

export function BookForm({ products, slots, minStart, defaultEnd, preselect, prefill }: Props) {
  const router = useRouter();
  const href = useSellerHref();
  const [productId, setProductId] = useState(preselect && products.some((p) => p.id === preselect) ? preselect : products[0]?.id ?? "");
  const [slotCode, setSlotCode] = useState(slots.find((s) => s.isActive)?.code ?? "S3");
  const [startDate, setStart] = useState(minStart);
  const [endDate, setEnd] = useState(defaultEnd);
  const [budget, setBudget] = useState("10000");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kw, setKw] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<{ code: string; total: number; payment: GatewayPayment | null } | null>(null);

  const product = products.find((p) => p.id === productId);
  const slot = slots.find((s) => s.code === slotCode);
  const b = Math.round(Number(budget) || 0);
  const days = useMemo(() => {
    const d = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
    return Number.isFinite(d) ? d : 0;
  }, [startDate, endDate]);
  const clicks = slot && slot.rate > 0 ? Math.floor(b / slot.rate) : 0;

  function addKw(raw: string) {
    const parts = raw.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2 && t.length <= 40);
    if (parts.length) setKeywords((p) => [...new Set([...p, ...parts])].slice(0, 15));
    setKw("");
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (!productId) e.productId = "Choose a product";
    if (!slot?.isActive) e.slotCode = "This placement is paused — pick the other one";
    if (startDate < minStart) e.startDate = `Earliest start is ${fmtDate(`${minStart}T12:00:00+05:30`)}`;
    if (endDate < startDate) e.endDate = "End date must be after the start date";
    else if (days > 90) e.endDate = "Up to 90 days";
    if (b < MIN_BUDGET) e.budget = `Minimum budget is ${formatINR(MIN_BUDGET)}`;
    if (!agree) e.agree = "Please confirm";
    setErrors(e);
    if (Object.keys(e).length) return toast("Please check the highlighted fields", { icon: "info" });
    setBusy(true);
    try {
      const out = await api<{ campaign: { code: string; quote?: { total: number } } | null; payment: GatewayPayment | null; quote: { total: number } | null }>("/api/v1/seller/ads", {
        body: { productId, slotCode, startDate, endDate, budget: b, keywords: slotCode === "S3" ? keywords : [] },
      });
      if (!out.campaign) throw new Error("Booking didn't return a campaign");
      setBooked({ code: out.campaign.code, total: out.quote?.total ?? Math.round(b * (1 + GST)), payment: out.payment });
      toast(`Booked ${out.campaign.code} — complete payment to send it for review`, { icon: "megaphone" });
    } catch (ex) {
      if (ex instanceof ApiFailure && Object.keys(ex.fields).length) setErrors(Object.fromEntries(Object.entries(ex.fields).map(([k, v]) => [k, v?.[0] ?? ""])));
      toast(errorText(ex), { icon: "info" });
    } finally {
      setBusy(false);
    }
  }

  if (!products.length) {
    return (
      <div className="sl-card sl-empty">
        <Icon name="bag" />
        <b>No live products to promote yet</b>
        <p>Sponsored ads are available for products that are approved and in stock.</p>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="sl-card" style={{ display: "grid", gap: 16 }}>
        <div className="sl-empty" style={{ padding: "12px 8px 0" }}>
          <Icon name="check" />
          <b>Campaign {booked.code} booked</b>
          <p>
            {product?.name} · {slot?.name} · {fmtDate(`${startDate}T12:00:00+05:30`)} – {fmtDate(`${endDate}T12:00:00+05:30`)}. Total payable {formatINR(booked.total)} incl. GST.
          </p>
        </div>
        <PayPanel
          code={booked.code}
          payment={booked.payment}
          prefill={prefill}
          onPaid={() => {
            router.push(href("/seller/ads"));
            router.refresh();
          }}
        />
        <div className="sl-actions" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(href("/seller/ads"))}>
            Pay later from Sponsored ads
          </button>
        </div>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? <small className="sl-err">{errors[k]}</small> : null);

  return (
    <form
      className="sl-editor"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <div className="sl-form">
        <section className="sl-card sl-form-sec" aria-labelledby="bk-p">
          <h3 id="bk-p">
            <Icon name="bag" /> 1. Product to promote
          </h3>
          <label className="sl-field">
            <span>Product</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} aria-invalid={!!errors.productId}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.name} ({formatINR(p.price)})
                </option>
              ))}
            </select>
            {err("productId") ?? <small>Only your live, in-stock products can be promoted.</small>}
          </label>
          {product ? (
            <div className="sl-prod" style={{ minWidth: 0 }}>
              <Thumb name={product.name} brand={product.brand} image={product.image} art={product.art} size="lg" />
              <span>
                <b>{product.name}</b>
                <small>
                  {product.brand} · {formatINR(product.price)} · {product.stock} in stock
                </small>
              </span>
            </div>
          ) : null}
        </section>

        <section className="sl-card sl-form-sec" aria-labelledby="bk-s">
          <h3 id="bk-s">
            <Icon name="target" /> 2. Where it shows
          </h3>
          <div className="sl-pz-grid" role="radiogroup" aria-label="Placement">
            {slots.map((s) => (
              <label key={s.code} className={s.isActive ? "sl-pz-opt" : "sl-pz-opt is-off"}>
                <input type="radio" name="slot" value={s.code} checked={slotCode === s.code} disabled={!s.isActive} onChange={() => setSlotCode(s.code)} />
                <b>
                  <span className="sl-sid">{s.code}</span> {SLOT_COPY[s.code]?.title ?? s.name}
                </b>
                <small>{SLOT_COPY[s.code]?.where}</small>
                <em>
                  {formatINR(s.rate)} per click{!s.isActive ? " · paused right now" : ""}
                </em>
              </label>
            ))}
          </div>
          {err("slotCode")}
        </section>

        <section className="sl-card sl-form-sec" aria-labelledby="bk-d">
          <h3 id="bk-d">
            <Icon name="calendar" /> 3. Dates &amp; budget
          </h3>
          <div className="sl-fgrid sl-fgrid-3">
            <label className="sl-field">
              <span>Start</span>
              <input type="date" value={startDate} min={minStart} onChange={(e) => setStart(e.target.value)} aria-invalid={!!errors.startDate} />
              {err("startDate") ?? <small>From tomorrow — we review every ad first.</small>}
            </label>
            <label className="sl-field">
              <span>End</span>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!errors.endDate} />
              {err("endDate") ?? <small>{days > 0 ? `${days} days` : ""} · up to 90</small>}
            </label>
            <label className="sl-field">
              <span>Total budget</span>
              <span className="sl-rs">
                <i>₹</i>
                <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} aria-invalid={!!errors.budget} />
              </span>
              {err("budget") ?? <small>Minimum {formatINR(MIN_BUDGET)} · excl. GST</small>}
            </label>
          </div>
          {slotCode === "S3" ? (
            <label className="sl-field">
              <span>
                Search keywords <em>(optional — we also match your product&apos;s name, brand and category)</em>
              </span>
              <span className="sl-tagin">
                {keywords.map((k) => (
                  <span className="sl-tag" key={k}>
                    {k}
                    <button type="button" aria-label={`Remove ${k}`} onClick={() => setKeywords((p) => p.filter((x) => x !== k))}>
                      <Icon name="close" />
                    </button>
                  </span>
                ))}
                <input
                  value={kw}
                  placeholder={keywords.length ? "Add more…" : "e.g. beard oil, beard growth"}
                  onChange={(e) => (e.target.value.endsWith(",") ? addKw(e.target.value) : setKw(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKw(kw);
                    }
                  }}
                  onBlur={() => kw && addKw(kw)}
                />
              </span>
            </label>
          ) : null}
        </section>

        <div className="sl-sticky-act">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 16, height: 16 }} aria-invalid={!!errors.agree} />
            The listing is accurate and follows the advertising guidelines
          </label>
          <span className="sl-spacer" />
          <button type="submit" className="btn btn-cart" disabled={busy}>
            <Icon name="megaphone" /> {busy ? "Booking…" : `Book & pay ${formatINR(Math.round(b * (1 + GST)))}`}
          </button>
        </div>
      </div>

      <aside className="sl-editor-side" aria-label="Estimate">
        <div className="sl-card">
          <div className="sl-card-h" style={{ marginBottom: 12 }}>
            <div>
              <h2>Estimate</h2>
              <p>Pay per click — you&apos;re never charged for views</p>
            </div>
          </div>
          <div className="sl-est" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <small>Up to</small>
              <b className="num">{clicks.toLocaleString("en-IN")} clicks</b>
            </div>
            <div>
              <small>Per day</small>
              <b className="num">{days > 0 ? formatINR(Math.round(b / days)) : "—"}</b>
            </div>
          </div>
          <div className="sl-earn" style={{ marginTop: 14 }}>
            <div>
              <span>Budget</span>
              <b className="num">{formatINR(b)}</b>
            </div>
            <div>
              <span>GST (18%)</span>
              <b className="num">{formatINR(Math.round(b * GST))}</b>
            </div>
            <div className="tot">
              <span>Payable now</span>
              <b className="num" style={{ color: "var(--text)" }}>{formatINR(Math.round(b * (1 + GST)))}</b>
            </div>
          </div>
          <div className="sl-card-foot">
            Campaigns go live after a quick review (usually same day). Spend stops automatically when the budget is used up or the end date passes.
          </div>
        </div>
      </aside>
    </form>
  );
}
