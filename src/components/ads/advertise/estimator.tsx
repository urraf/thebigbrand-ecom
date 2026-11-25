"use client";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AdSlotCard } from "@/server/ads/slots";
import { Icon } from "@/components/ui/icon";
import { estimateDelivery, isTimeBased, quoteBooking, UNIT_DAYS, type PricingModelCode } from "../lib/pricing";
import { addDays, AV_EVENT, avEmit, dLabel, flash, fmt, GROUPS, grpOf, nf, pageName, pct, salesMail, scrollToId, type AvAct } from "./shared";

type Mode = "days" | "budget";
type Est = { net: number; run: number; units: number | null; discountPct: number; perDay: number; imp: number; clicks: number; orders: number; roas: number; ecpm: number };

const UNIT_NAME: Record<string, string> = { DAY: "day", WEEK: "week", MONTH: "month" };

function quote(s: AdSlotCard, days: number, aov: number): Est {
  const timeBased = isTimeBased(s.pricingModel);
  const probe = estimateDelivery(s, s.reach, 1, 0, aov);
  let net: number;
  let run = days;
  let units: number | null = null;
  let discountPct = 0;
  if (timeBased) {
    const q = quoteBooking(s, days);
    net = q.net;
    run = q.run;
    units = q.units;
    discountPct = q.discountPct;
  } else {
    net = Math.round(probe.perDay * days);
  }
  const d = estimateDelivery(s, s.reach, run, net, aov);
  return { net, run, units, discountPct, perDay: probe.perDay, imp: d.imp, clicks: d.clicks, orders: d.orders, roas: d.roas, ecpm: d.ecpm };
}

function estimate(s: AdSlotCard, mode: Mode, days: number, budget: number, aov: number): { q: Est | null; min: number } {
  if (mode === "days") return { q: quote(s, days, aov), min: 0 };
  if (isTimeBased(s.pricingModel)) {
    const unit = UNIT_DAYS[s.pricingModel as PricingModelCode] ?? 1;
    let best: Est | null = null;
    for (let u = 1; u * unit <= 90; u++) {
      const q = quote(s, u * unit, aov);
      if (q.net <= budget) best = q;
    }
    return { q: best, min: quote(s, unit, aov).net };
  }
  const per = estimateDelivery(s, s.reach, 1, 0, aov).perDay || 1;
  const run = budget / per;
  const d = estimateDelivery(s, s.reach, run, budget, aov);
  return { q: { net: budget, run, units: null, discountPct: 0, perDay: per, imp: d.imp, clicks: d.clicks, orders: d.orders, roas: d.roas, ecpm: d.ecpm }, min: 0 };
}

/** Campaign estimator (demo estimator): pick a placement, set a duration or a budget, see cost and delivery. */
export function Estimator({ slots, aov, today }: { slots: AdSlotCard[]; aov: number; today: string }) {
  const [code, setCode] = useState(slots.find((s) => s.code === "H1")?.code ?? slots[0]?.code ?? "H1");
  const [mode, setMode] = useState<Mode>("days");
  const [days, setDays] = useState(7);
  const [budget, setBudget] = useState(50000);
  const s = slots.find((x) => x.code === code) ?? slots[0];

  useEffect(() => {
    const onAct = (e: Event) => {
      const a = (e as CustomEvent<AvAct>).detail;
      if (a?.type === "estimate" && slots.some((x) => x.code === a.slot)) {
        setCode(a.slot);
        scrollToId("av-est");
        setTimeout(() => flash("av-e-out"), 350);
      }
    };
    window.addEventListener(AV_EVENT, onAct);
    // deep link: /advertise?slot=X1 (managed slots open the estimator)
    const qs = new URLSearchParams(location.search).get("slot")?.toUpperCase();
    const hit = qs && slots.find((x) => x.code === qs);
    const t = hit && !hit.bookable
      ? setTimeout(() => {
          setCode(hit.code);
          scrollToId("av-est");
        }, 120)
      : undefined;
    return () => {
      window.removeEventListener(AV_EVENT, onAct);
      clearTimeout(t);
    };
  }, [slots]);

  const r = useMemo(() => (s ? estimate(s, mode, days, budget, aov) : null), [s, mode, days, budget, aov]);
  const compare = useMemo(() => {
    return slots
      .filter((x) => x.code !== code)
      .map((x) => ({ s: x, r: estimate(x, mode, days, budget, aov) }))
      .filter((x): x is { s: AdSlotCard; r: { q: Est; min: number } } => !!x.r.q)
      .sort((a, b) => b.r.q.orders - a.r.q.orders)
      .slice(0, 4);
  }, [slots, code, mode, days, budget, aov]);

  if (!s || !r) return null;
  const timeBased = isTimeBased(s.pricingModel);
  const unitName = UNIT_NAME[s.pricingModel] ?? "unit";
  const rangeVal = mode === "days" ? days : budget;
  const pctPos = mode === "days" ? ((days - 1) / 59) * 100 : ((budget - 5000) / 495000) * 100;

  let out: ReactNode;
  if (!r.q) {
    out = (
      <>
        <div className="av-eo-top">
          <span>Estimated cost</span>
          <b>{fmt(r.min)}</b>
          <small>
            Minimum booking for {s.name} is one {unitName} ({s.rateLabel}). Raise your budget to start.
          </small>
        </div>
        <div className="av-eo-empty">
          <Icon name="info" />
          Your {fmt(budget)} budget is below the minimum for this placement.
        </div>
      </>
    );
  } else {
    const q = r.q;
    const run = q.run;
    let sub: ReactNode;
    if (mode === "days") {
      sub = timeBased ? (
        <>
          {q.units} {unitName}
          {q.units! > 1 ? "s" : ""} × {fmt(s.rate)}
          {s.pricingModel !== "DAY" ? ` · runs ${run} days` : ""}
          {q.discountPct ? ` · incl. ${q.discountPct * 100}% volume discount` : ""}
        </>
      ) : (
        <>
          {days} days × ~{fmt(q.perDay)}/day · billed on delivery
        </>
      );
    } else {
      sub = timeBased ? (
        <>
          Your {fmt(budget)} books <b>{run} days</b>
          {q.discountPct ? ` with ${q.discountPct * 100}% volume discount` : ""}
          {budget - q.net > 0 ? ` · ${fmt(budget - q.net)} left over` : ""}
        </>
      ) : (
        <>
          Runs ≈ <b>
            {Math.max(1, Math.round(run))} day{Math.round(run) > 1 ? "s" : ""}
          </b>{" "}
          at full delivery · {s.rateLabel}
        </>
      );
    }
    const n = Math.max(1, Math.min(30, Math.ceil(run - 1e-9)));
    const start = addDays(today, 2);
    const bars = Array.from({ length: n }, (_, i) => {
      const iso = addDays(start, i);
      const w = new Date(`${iso}T00:00:00Z`).getUTCDay();
      const k = w === 0 || w === 6 ? 1.22 : w === 5 ? 1.08 : 0.94 + ((i * 7) % 5) / 100;
      const frac = i === n - 1 && run % 1 ? run % 1 : 1;
      return { iso, we: w === 0 || w === 6, v: s.reach.imp * k * frac };
    });
    const max = Math.max(...bars.map((x) => x.v));
    const kp: [string, string][] = [
      [s.reach.impL, nf(q.imp)],
      [s.reach.clkL, nf(q.clicks)],
      [s.reach.ctrL, pct(s.reach.ctr)],
      ["Est. orders", nf(q.orders)],
      ["Effective CPM", s.pricingModel === "BOX" ? `₹${s.rate}/box` : fmt(q.ecpm)],
      ["Est. ROAS", q.roas.toFixed(1) + "×"],
    ];
    out = (
      <>
        <div className="av-eo-top">
          <span>
            Estimated cost <i>excl. GST</i>
          </span>
          <b>{fmt(q.net)}</b>
          <small>{sub}</small>
        </div>
        <dl className="av-eo-kpis">
          {kp.map(([l, v], i) => (
            <div key={l} className={i === 5 ? "av-roas" : undefined}>
              <dt>{l}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="av-eo-ch">
          <div className="av-eo-ch-h">
            <span>Projected daily {s.reach.impL.toLowerCase()}</span>
            <small>{run > 30 ? `first 30 of ${Math.round(run)} days` : `${n} day${n > 1 ? "s" : ""} from ${dLabel(start)}`}</small>
          </div>
          <div className="av-bars" role="img" aria-label={`Bar chart of projected daily ${s.reach.impL.toLowerCase()}, peaking at about ${nf(max)} on weekends`}>
            {bars.map((x) => (
              <span key={x.iso} className={x.we ? "av-bar we" : "av-bar"} style={{ height: `${Math.max(4, (x.v / max) * 100)}%` } as CSSProperties} data-tip={`${dLabel(x.iso)} · ${nf(x.v)}`} />
            ))}
          </div>
          <div className="av-bars-x">
            <span>{dLabel(bars[0].iso)}</span>
            <span>{n > 1 ? dLabel(bars[n - 1].iso) : ""}</span>
          </div>
        </div>
        <div className="av-eo-foot">
          <p>
            <Icon name="info" />
            {s.measured ? `Reach from the last 30 days of delivery on ${s.code}; ` : "Reach is a sample estimate until this slot has delivery history; "}
            {pct(s.reach.cvr)} click-to-order rate and {fmt(aov)} average order value.
          </p>
          {s.bookable ? (
            <button type="button" className="btn btn-cart" onClick={() => avEmit({ type: "pick", slot: s.code, days: mode === "days" && timeBased ? run : undefined })}>
              Book this placement <Icon name="arrow" />
            </button>
          ) : (
            <a className="btn btn-light" href={salesMail(`${s.code} · ${s.name} — enquiry`)}>
              Talk to partnerships <Icon name="arrow" />
            </a>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="av-est">
      <div className="av-est-in">
        <label className="av-fld">
          <span>Placement</span>
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {GROUPS.map((g) => {
              const list = slots.filter((x) => grpOf(x.page) === g.id);
              if (!list.length) return null;
              return (
                <optgroup key={g.id} label={g.name}>
                  {list.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.code} · {x.name} — {x.rateLabel}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <div className="av-e-info">
          <span className="av-id">{s.code}</span>
          <span>
            <b>{s.name}</b>
            <small>
              {pageName(s.page)} · {s.format}
            </small>
          </span>
          <span className="av-e-r">
            <b>{s.rateLabel}</b>
            <small>
              ~{nf(s.reach.imp)} {s.reach.impL.toLowerCase()}/day
            </small>
          </span>
        </div>
        <div className="av-seg" role="radiogroup" aria-label="Estimate by">
          <button type="button" role="radio" aria-checked={mode === "days"} onClick={() => setMode("days")}>
            <Icon name="calendar" />
            By duration
          </button>
          <button type="button" role="radio" aria-checked={mode === "budget"} onClick={() => setMode("budget")}>
            <Icon name="target" />
            By budget
          </button>
        </div>
        <div className="av-range">
          <div className="av-range-h">
            <label htmlFor="av-e-range">{mode === "days" ? "Campaign length" : "Total budget"}</label>
            <b>{mode === "days" ? `${days} day${days > 1 ? "s" : ""}` : fmt(budget)}</b>
          </div>
          <input
            type="range"
            id="av-e-range"
            min={mode === "days" ? 1 : 5000}
            max={mode === "days" ? 60 : 500000}
            step={mode === "days" ? 1 : 5000}
            value={rangeVal}
            style={{ "--p": `${pctPos}%` } as CSSProperties}
            onChange={(e) => (mode === "days" ? setDays(Number(e.target.value)) : setBudget(Number(e.target.value)))}
          />
          <div className="av-chips">
            {(mode === "days"
              ? ([3, 7, 14, 30].map((d) => [d, `${d} days`]) as [number, string][])
              : ([
                  [10000, "₹10K"],
                  [25000, "₹25K"],
                  [50000, "₹50K"],
                  [100000, "₹1L"],
                  [250000, "₹2.5L"],
                ] as [number, string][])
            ).map(([v, l]) => (
              <button key={v} type="button" className={rangeVal === v ? "chip on" : "chip"} onClick={() => (mode === "days" ? setDays(v) : setBudget(v))}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="av-cmp">
          <div className="av-cmp-h">
            <b>Compare at {mode === "days" ? `${days} day${days > 1 ? "s" : ""}` : `a ${fmt(budget)} budget`}</b>
            <small>Most orders for the same {mode === "days" ? "duration" : "budget"}</small>
          </div>
          {compare.map(({ s: x, r: rr }) => (
            <button
              key={x.code}
              type="button"
              className="av-cmp-r"
              onClick={() => {
                setCode(x.code);
                flash("av-e-out");
              }}
              aria-label={`Estimate ${x.name} instead`}
            >
              <span className="av-id">{x.code}</span>
              <span className="av-cmp-n">
                <b>{x.name}</b>
                <small>
                  ~{nf(rr.q.orders)} orders · {fmt(rr.q.net)}
                </small>
              </span>
              <em>
                {rr.q.roas.toFixed(1)}× <small>ROAS</small>
              </em>
              <Icon name="chevRight" />
            </button>
          ))}
        </div>
      </div>
      <div className="av-est-out" id="av-e-out" aria-live="polite">
        {out}
      </div>
    </div>
  );
}
