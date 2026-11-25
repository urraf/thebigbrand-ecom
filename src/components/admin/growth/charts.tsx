/**
 * Inline-SVG charts for the growth pages (no chart library). Server-compatible (no hooks): every label and
 * tooltip string is computed here; <ChartTips/> (client) shows the tooltip for any element carrying
 * data-tip / data-tip-rows on hover and keyboard focus.
 *
 * Specs (dataviz): one y-axis, bars ≤ 24px with 4px rounded data-ends and square baselines, 2px surface gap
 * between stacked segments, hairline solid grid, selective direct labels (peak only), legend for ≥ 2 series,
 * a table twin for every chart (see <ChartTable/>). Palette: ad revenue #ff3d6e / product sales #5b35e0 (validated).
 * Two renders (desktop 1000-wide, phone 360-wide) are toggled with CSS so text never scales below legibility.
 */
import type { CSSProperties, ReactNode } from "react";
import { compactINR, compactNumber, formatINR } from "@/lib/money";

export type TipRow = [label: string, value: string, key?: "a" | "s" | ""];
const tipAttr = (rows: TipRow[]) => rows.map((r) => r.map((x) => String(x ?? "").replace(/[|;]/g, " ")).join("|")).join(";");

/** Clean axis ticks: 0 and 3–5 steps of 1/2/2.5/5 × 10^k covering max. */
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) out.push(Math.round(v * 1000) / 1000);
  if (out.length < 2) out.push(step);
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-24" → "24 Nov" */
export const dayLabel = (key: string) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
/** "2026-11" → "Nov 2026" */
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weekdayLabel = (key: string) => `${WD[new Date(`${key}T12:00:00Z`).getUTCDay()]}, ${dayLabel(key)}`;

export type ValueFormat = "inr" | "num" | "pct";
export function fmtValue(v: number, f: ValueFormat, compact = false): string {
  if (f === "inr") return compact ? compactINR(v) : formatINR(v);
  if (f === "pct") return `${(v * 100).toFixed(compact ? 1 : 2)}%`;
  return compact ? compactNumber(v) : Math.round(v).toLocaleString("en-IN");
}

/** Path for a column with a 4px rounded top and a square baseline. */
function colPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x.toFixed(1)},${(y + h).toFixed(1)}V${(y + rr).toFixed(1)}Q${x.toFixed(1)},${y.toFixed(1)} ${(x + rr).toFixed(1)},${y.toFixed(1)}H${(x + w - rr).toFixed(1)}Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + rr).toFixed(1)}V${(y + h).toFixed(1)}Z`;
}

type Dims = { w: number; plotH: number; padL: number; padR: number; padT: number; padB: number; maxLabels: number };
const DESKTOP: Dims = { w: 1000, plotH: 250, padL: 58, padR: 8, padT: 26, padB: 30, maxLabels: 10 };
const WIDE: Dims = { w: 740, plotH: 220, padL: 54, padR: 6, padT: 24, padB: 28, maxLabels: 8 };
const HALF: Dims = { w: 600, plotH: 200, padL: 52, padR: 6, padT: 24, padB: 28, maxLabels: 6 };
const PHONE: Dims = { w: 360, plotH: 190, padL: 44, padR: 4, padT: 24, padB: 28, maxLabels: 4 };

function labelEvery(n: number, maxLabels: number) {
  return Math.max(1, Math.ceil(n / maxLabels));
}

// ───────────────────────────── stacked daily columns (ad + sales) ─────────────────────────────

export type StackPoint = { key: string; label: string; full: string; a: number; s: number; extra?: TipRow[]; now?: boolean };

function StackSvg({ points, d, labelA, labelS, aria }: { points: StackPoint[]; d: Dims; labelA: string; labelS: string; aria: string }) {
  const n = Math.max(1, points.length);
  const max = Math.max(1, ...points.map((p) => p.a + p.s));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const h = d.padT + d.plotH + d.padB;
  const base = d.padT + d.plotH;
  const plotW = d.w - d.padL - d.padR;
  const band = plotW / n;
  const bw = Math.max(1.5, Math.min(24, band * (band > 8 ? 0.62 : 0.8)));
  const y = (v: number) => base - (v / top) * d.plotH;
  const every = labelEvery(n, d.maxLabels);
  const peak = points.reduce((best, p, i) => (p.a + p.s > points[best].a + points[best].s ? i : best), 0);
  const gap = bw >= 4 ? 2 : 1;

  return (
    <svg className="ag-svg" viewBox={`0 0 ${d.w} ${h}`} role="group" aria-label={aria}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={d.padL} x2={d.w - d.padR} y1={y(t)} y2={y(t)} className={t ? "gl" : "bl"} />
          <text x={d.padL - 8} y={y(t) + 4} textAnchor="end" className="tk">
            {t ? compactINR(t) : "₹0"}
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const bx = d.padL + band * i;
        const cx = bx + band / 2;
        const x = cx - bw / 2;
        const aH = (p.a / top) * d.plotH;
        const sH = (p.s / top) * d.plotH;
        const aY = base - aH;
        const sGap = aH > 0 && sH > 0 ? gap : 0;
        const sY = aY - sGap - sH;
        const total = p.a + p.s;
        const rows: TipRow[] = [
          ["Total", formatINR(total), ""],
          [labelA, formatINR(p.a), "a"],
          [labelS, formatINR(p.s), "s"],
          ...(p.extra ?? []),
        ];
        const showLabel = i === n - 1 || (i % every === 0 && n - 1 - i >= Math.ceil(every * 0.7));
        return (
          <g className="ag-col" key={p.key}>
            <rect className="ag-band" x={bx} y={d.padT - 16} width={band} height={d.plotH + 16} rx={Math.min(6, band / 3)} />
            {aH > 0 ? <path className="a" d={sH > 0 ? colPath(x, aY, bw, aH, 0) : colPath(x, aY, bw, aH)} /> : null}
            {sH > 0 ? <path className="s" d={colPath(x, sY, bw, sH)} /> : null}
            {i === peak && total > 0 ? (
              <text x={cx} y={Math.max(12, sY - 6)} textAnchor={i > n - 3 ? "end" : i < 2 ? "start" : "middle"} className="cap">
                {compactINR(total)}
              </text>
            ) : null}
            {showLabel ? (
              <text x={cx} y={base + 19} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className={p.now ? "xl now" : "xl"}>
                {p.label}
              </text>
            ) : null}
            <rect
              className="ag-hit"
              x={bx}
              y={0}
              width={band}
              height={h}
              tabIndex={0}
              role="img"
              aria-label={`${p.full}: total ${formatINR(total)}, ${labelA} ${formatINR(p.a)}, ${labelS} ${formatINR(p.s)}`}
              data-tip={p.full}
              data-tip-rows={tipAttr(rows)}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function StackedColumns({
  points,
  labelA = "Ad revenue",
  labelS = "Product sales",
  aria,
  size = "full",
}: {
  points: StackPoint[];
  labelA?: string;
  labelS?: string;
  aria: string;
  /** "half" for charts in a half-width card */
  size?: "full" | "wide" | "half";
}) {
  if (!points.length) return <div className="ag-chart-empty">No data for this period yet</div>;
  return (
    <div className="ag-chart">
      <div className="ag-only-d">
        <StackSvg points={points} d={size === "half" ? HALF : size === "wide" ? WIDE : DESKTOP} labelA={labelA} labelS={labelS} aria={aria} />
      </div>
      <div className="ag-only-m">
        <StackSvg points={points} d={PHONE} labelA={labelA} labelS={labelS} aria={aria} />
      </div>
    </div>
  );
}

// ───────────────────────────── single-series columns ─────────────────────────────

export type ColPoint = { key: string; label: string; full: string; v: number; extra?: TipRow[]; now?: boolean };

function ColSvg({ points, d, format, series, tone, aria }: { points: ColPoint[]; d: Dims; format: ValueFormat; series: string; tone: "pz" | "s"; aria: string }) {
  const n = Math.max(1, points.length);
  const max = Math.max(format === "pct" ? 0.001 : 1, ...points.map((p) => p.v));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const h = d.padT + d.plotH + d.padB;
  const base = d.padT + d.plotH;
  const plotW = d.w - d.padL - d.padR;
  const band = plotW / n;
  const bw = Math.max(1.5, Math.min(24, band * (band > 8 ? 0.62 : 0.8)));
  const y = (v: number) => base - (v / top) * d.plotH;
  const every = labelEvery(n, d.maxLabels);
  const peak = points.reduce((best, p, i) => (p.v > points[best].v ? i : best), 0);
  return (
    <svg className="ag-svg" viewBox={`0 0 ${d.w} ${h}`} role="group" aria-label={aria}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={d.padL} x2={d.w - d.padR} y1={y(t)} y2={y(t)} className={t ? "gl" : "bl"} />
          <text x={d.padL - 8} y={y(t) + 4} textAnchor="end" className="tk">
            {t ? fmtValue(t, format, true) : format === "inr" ? "₹0" : "0"}
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const bx = d.padL + band * i;
        const cx = bx + band / 2;
        const hgt = (p.v / top) * d.plotH;
        const showLabel = i === n - 1 || (i % every === 0 && n - 1 - i >= Math.ceil(every * 0.7));
        return (
          <g className="ag-col" key={p.key}>
            <rect className="ag-band" x={bx} y={d.padT - 16} width={band} height={d.plotH + 16} rx={Math.min(6, band / 3)} />
            {hgt > 0 ? <path className={tone === "pz" ? "v pz" : "v"} d={colPath(cx - bw / 2, base - hgt, bw, hgt)} /> : null}
            {i === peak && p.v > 0 ? (
              <text x={cx} y={Math.max(12, base - hgt - 6)} textAnchor={i > n - 3 ? "end" : i < 2 ? "start" : "middle"} className="cap">
                {fmtValue(p.v, format, true)}
              </text>
            ) : null}
            {showLabel ? (
              <text x={cx} y={base + 19} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className={p.now ? "xl now" : "xl"}>
                {p.label}
              </text>
            ) : null}
            <rect
              className="ag-hit"
              x={bx}
              y={0}
              width={band}
              height={h}
              tabIndex={0}
              role="img"
              aria-label={`${p.full}: ${series} ${fmtValue(p.v, format)}`}
              data-tip={p.full}
              data-tip-rows={tipAttr([[series, fmtValue(p.v, format), tone === "pz" ? "a" : "s"], ...(p.extra ?? [])])}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function Columns({
  points,
  format,
  series,
  tone = "pz",
  aria,
  size = "full",
}: {
  points: ColPoint[];
  format: ValueFormat;
  series: string;
  tone?: "pz" | "s";
  aria: string;
  size?: "full" | "wide" | "half";
}) {
  if (!points.length) return <div className="ag-chart-empty">No delivery data yet</div>;
  return (
    <div className="ag-chart">
      <div className="ag-only-d">
        <ColSvg points={points} d={size === "half" ? HALF : size === "wide" ? WIDE : DESKTOP} format={format} series={series} tone={tone} aria={aria} />
      </div>
      <div className="ag-only-m">
        <ColSvg points={points} d={PHONE} format={format} series={series} tone={tone} aria={aria} />
      </div>
    </div>
  );
}

// ───────────────────────────── ranked horizontal bars ─────────────────────────────

export type RankItem = { key: string; label: ReactNode; ariaLabel: string; value: number; valueText: string; side?: ReactNode; tip?: { title: string; rows: TipRow[] } };

export function RankBars({ items, tone = "pz", empty = "Nothing to rank yet" }: { items: RankItem[]; tone?: "pz" | "s"; empty?: string }) {
  if (!items.length) return <p className="am-muted am-pad">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="ag-rank">
      {items.map((it) => (
        <li
          key={it.key}
          tabIndex={0}
          aria-label={`${it.ariaLabel}: ${it.valueText}`}
          data-tip={it.tip?.title}
          data-tip-rows={it.tip ? tipAttr(it.tip.rows) : undefined}
        >
          <span className="ag-rank-n">
            {it.label}
            {it.side ? <small>{it.side}</small> : null}
          </span>
          <span className={tone === "s" ? "ag-rank-bar s" : "ag-rank-bar"}>
            <i style={{ "--p": (it.value / max).toFixed(3) } as CSSProperties} />
            <em>{it.valueText}</em>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Thin inline bar used inside table cells (share of the column max). */
export function CellBar({ value, max, text }: { value: number; max: number; text: ReactNode }) {
  return (
    <span className="ag-cellbar">
      <b>{text}</b>
      <i style={{ "--p": (max > 0 ? value / max : 0).toFixed(3) } as CSSProperties} aria-hidden="true" />
    </span>
  );
}

/** Fill meter + percentage (same-ramp track). */
export function FillMeter({ value, tone = "s", label }: { value: number; tone?: "s" | "pz"; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="am-fill" role="img" aria-label={label ?? `${Math.round(v * 100)}% filled`}>
      <div className={tone === "pz" ? "am-meter am-meter-pz" : "am-meter"} style={{ "--p": v.toFixed(3), marginTop: 0 } as CSSProperties}>
        <i />
      </div>
      <span className="num">{Math.round(v * 100)}%</span>
    </div>
  );
}
