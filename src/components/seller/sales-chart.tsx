"use client";
/**
 * 30-day daily sales — single-series column chart (one hue, no legend: the card title names the series).
 * Spec: ≤24px columns, 4px rounded data-end / square baseline, hairline solid grid, one direct label (best day),
 * per-column hover + keyboard focus tooltip (roving tabindex, ←/→), and a table view so no value is tooltip-only.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { fmtDay, fmtShort } from "./format";

export type SalesPoint = { date: string; sales: number; units: number; orders: number };

const H = 250;
const PAD = { t: 24, r: 8, b: 30, l: 52 };
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

function tick(v: number, compact: boolean) {
  if (!compact) return "₹" + v.toLocaleString("en-IN");
  if (v >= 100000) return "₹" + (v / 100000).toFixed(v % 100000 ? 1 : 0) + "L";
  return "₹" + (v / 1000).toFixed(v % 1000 ? 1 : 0) + "K";
}

/** Date key "2026-11-24" → noon IST so labels never slip a day. */
const keyDate = (k: string) => new Date(`${k}T12:00:00+05:30`);

function colPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function SalesChart({ data }: { data: SalesPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(data.length - 1);
  const cols = useRef<(SVGGElement | null)[]>([]);

  useIsoLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...data.map((d) => d.sales));
  const top = niceMax(max * 1.08);
  const compact = top >= 10000;
  const plotW = w - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(24, band * 0.62));
  const y = (v: number) => PAD.t + plotH - (v / top) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const bestIdx = max > 0 ? data.findIndex((d) => d.sales === max) : -1;
  const every = w < 480 ? 7 : w < 760 ? 5 : 3;

  const focusCol = useCallback((i: number) => {
    const n = Math.max(0, Math.min(data.length - 1, i));
    setFocusIdx(n);
    setHover(n);
    cols.current[n]?.focus();
  }, [data.length]);

  const tipIdx = hover;
  const tip = tipIdx != null ? data[tipIdx] : null;
  const tipX = tipIdx != null ? PAD.l + band * tipIdx + band / 2 : 0;
  const tipY = tip ? Math.min(y(tip.sales), PAD.t + plotH - 4) : 0;

  return (
    <div className="sl-chart" ref={box}>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="group"
        aria-label={`Daily sales for the last ${data.length} days. Best day ${bestIdx >= 0 ? `${fmtDay(keyDate(data[bestIdx].date))}, ${formatINR(max)}` : "none"}.`}
        onMouseLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); focusCol(focusIdx + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); focusCol(focusIdx - 1); }
          if (e.key === "Home") { e.preventDefault(); focusCol(0); }
          if (e.key === "End") { e.preventDefault(); focusCol(data.length - 1); }
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "bl" : "gl"} x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="tk" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">
              {tick(t, compact)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.l + band * i + band / 2;
          const h = d.sales > 0 ? Math.max(2, PAD.t + plotH - y(d.sales)) : 0;
          const isLast = i === data.length - 1;
          const showX = isLast || (i % every === 0 && data.length - 1 - i >= Math.ceil(every / 2));
          return (
            <g
              key={d.date}
              className="col"
              ref={(el) => { cols.current[i] = el; }}
              tabIndex={i === focusIdx ? 0 : -1}
              role="img"
              aria-label={`${fmtDay(keyDate(d.date))}: ${d.sales ? `${formatINR(d.sales)}, ${d.units} units, ${d.orders} orders` : "no sales"}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => { setHover(i); setFocusIdx(i); }}
              onBlur={() => setHover(null)}
            >
              <rect className="band" x={PAD.l + band * i} y={PAD.t} width={band} height={plotH} rx={4} />
              {h > 0 ? <path className="bar" d={colPath(cx - barW / 2, PAD.t + plotH - h, barW, h)} /> : null}
              {i === bestIdx ? (
                <text className="cap" x={cx} y={y(d.sales) - 7} textAnchor={i > data.length - 3 ? "end" : i < 2 ? "start" : "middle"}>
                  {formatINR(d.sales)}
                </text>
              ) : null}
              {showX ? (
                <text className={isLast ? "xl now" : "xl"} x={cx} y={H - 8} textAnchor={isLast ? "end" : "middle"}>
                  {isLast ? "Today" : fmtShort(keyDate(d.date))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="sl-tip" hidden={!tip} style={{ left: tipX, top: tipY }} aria-hidden="true">
        {tip ? (
          <>
            <div className="sl-tip-t">{fmtDay(keyDate(tip.date))}</div>
            <div className="sl-tip-r">
              <i className="sl-tip-k" />
              <b>{formatINR(tip.sales)}</b>
              <span>sales</span>
            </div>
            <div className="sl-tip-r">
              <b>{tip.units}</b>
              <span>{tip.units === 1 ? "unit" : "units"} · {tip.orders} {tip.orders === 1 ? "order" : "orders"}</span>
            </div>
          </>
        ) : null}
      </div>
      <details className="sl-tview">
        <summary>
          <Icon name="chevRight" /> View as table
        </summary>
        <div className="sl-tscroll">
          <table className="sl-table sl-table-sm">
            <thead>
              <tr>
                <th>Day</th>
                <th className="r">Sales</th>
                <th className="r">Units</th>
                <th className="r">Orders</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{fmtDay(keyDate(d.date))}</td>
                  <td className="r num">{formatINR(d.sales)}</td>
                  <td className="r num">{d.units}</td>
                  <td className="r num">{d.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
