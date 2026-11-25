"use client";
/**
 * Dashboard revenue chart — product sales vs ad revenue per day (last 30 days, IST).
 * Views: Stacked columns (default) · Split (two small multiples, each on its own axis because ad revenue
 * and product sales differ by an order of magnitude) · Table (the accessible twin).
 * Marks follow the dataviz spec: ≤24px columns, 4px rounded data-end, square baseline, 2px surface gap
 * between stacked segments, solid hairline grid, legend for 2 series, selective direct labels
 * (best day + latest day), per-column hover/focus tooltip.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import { compactINR, formatINR } from "@/lib/money";

export type RevenuePoint = { date: string; sales: number; orders: number; ad: number };
type View = "stacked" | "split" | "table";
type Series = { key: "ad" | "sales"; label: string; cls: "a" | "s" };
const AD: Series = { key: "ad", label: "Ad revenue", cls: "a" };
const SALES: Series = { key: "sales", label: "Product sales", cls: "s" };

const dayLabel = (iso: string, long = false) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });

/** Clean axis: max rounded up to a 1/2/2.5/5 × 10ⁿ step, 4 intervals. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1000, ticks: [0, 250, 500, 750, 1000] };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const top = step * 4;
  return { top, ticks: [0, step, step * 2, step * 3, top] };
}

const tick = (v: number) => (v === 0 ? "₹0" : v >= 1000 ? compactINR(v) : formatINR(v));

type Tip = { x: number; y: number; i: number } | null;

function Columns({
  data,
  width,
  series,
  plotH,
  label,
  onTip,
  active,
}: {
  data: RevenuePoint[];
  width: number;
  series: Series[];
  plotH: number;
  label: string;
  onTip: (t: Tip) => void;
  active: number | null;
}) {
  const narrow = width < 560;
  const padL = narrow ? 44 : 54;
  const padR = 8;
  const padT = 26;
  const padB = 28;
  const h = padT + plotH + padB;
  const base = padT + plotH;
  const totals = data.map((d) => series.reduce((t, s) => t + d[s.key], 0));
  const { top, ticks } = niceScale(Math.max(...totals, 0));
  const plotW = width - padL - padR;
  const band = plotW / data.length;
  const bw = Math.max(3, Math.min(24, band * 0.62));
  const y = (v: number) => (v / top) * plotH;
  const best = totals.indexOf(Math.max(...totals));
  const last = data.length - 1;
  const every = narrow ? 7 : 5;
  const GAP = 2;
  const R = 4;

  return (
    <svg className="am-rev-svg" width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="group" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={width - padR} y1={base - y(t)} y2={base - y(t)} className={t ? "gl" : "bl"} />
          <text x={padL - 8} y={base - y(t) + 4} textAnchor="end" className="tk">
            {tick(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const bx = padL + band * i;
        const cx = bx + band / 2;
        const x = cx - bw / 2;
        // stack from the baseline: first series at the bottom, 2px surface gap between non-empty segments
        let cursor = base;
        const segs: Array<{ cls: string; y0: number; y1: number; top: boolean }> = [];
        const visible = series.filter((s) => d[s.key] > 0);
        visible.forEach((s, k) => {
          const hgt = y(d[s.key]);
          const gap = k > 0 ? GAP : 0;
          const y1 = cursor - gap;
          const y0 = Math.min(y1 - 0.75, y1 - hgt); // keep tiny values visible
          segs.push({ cls: s.cls, y0, y1, top: k === visible.length - 1 });
          cursor = y0;
        });
        const total = totals[i];
        const capY = segs.length ? segs[segs.length - 1].y0 : base;
        const showCap = total > 0 && (i === best || i === last);
        return (
          <g key={d.date} className={`am-col${active === i ? " is-on" : ""}`}>
            <rect className="am-band" x={bx + 1} y={padT - 18} width={Math.max(0, band - 2)} height={plotH + 18} rx={6} />
            {segs.map((sg, k) => {
              const hgt = sg.y1 - sg.y0;
              if (!sg.top) return <rect key={k} className={sg.cls} x={x} y={sg.y0} width={bw} height={hgt} />;
              const r = Math.min(R, hgt, bw / 2);
              return (
                <path
                  key={k}
                  className={sg.cls}
                  d={`M${x},${sg.y1}V${sg.y0 + r}Q${x},${sg.y0} ${x + r},${sg.y0}H${x + bw - r}Q${x + bw},${sg.y0} ${x + bw},${sg.y0 + r}V${sg.y1}Z`}
                />
              );
            })}
            {showCap ? (
              <text x={cx} y={capY - 7} textAnchor={i === last && narrow ? "end" : "middle"} className="cap">
                {compactINR(total)}
              </text>
            ) : null}
            {(i % every === 0 && last - i >= Math.ceil(every * 0.6)) || i === last ? (
              <text x={cx} y={base + 18} textAnchor={i === last ? "end" : "middle"} className={`xl${i === last ? " now" : ""}`} dx={i === last ? band / 2 - 2 : 0}>
                {i === last ? "Today" : dayLabel(d.date)}
              </text>
            ) : null}
            <rect
              className="am-hit"
              x={bx}
              y={0}
              width={band}
              height={h}
              tabIndex={0}
              role="img"
              aria-label={`${dayLabel(d.date, true)}: ${series.map((s) => `${s.label} ${formatINR(d[s.key])}`).join(", ")}${series.length > 1 ? `, total ${formatINR(total)}` : ""}`}
              onPointerEnter={(e) => onTip({ x: e.clientX, y: e.clientY, i })}
              onPointerMove={(e) => onTip({ x: e.clientX, y: e.clientY, i })}
              onPointerLeave={() => onTip(null)}
              onFocus={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onTip({ x: r.left + r.width / 2, y: r.top + 40, i });
              }}
              onBlur={() => onTip(null)}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [view, setView] = useState<View>("stacked");
  const [width, setWidth] = useState(760);
  const [tip, setTip] = useState<Tip>(null);
  const box = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((ents) => {
      const w = Math.round(ents[0].contentRect.width);
      if (w > 0) setWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  useEffect(() => {
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, []);

  // keep the tooltip inside the viewport
  const [pos, setPos] = useState<CSSProperties>({});
  useEffect(() => {
    if (!tip || !tipRef.current) return;
    const w = tipRef.current.offsetWidth;
    const hh = tipRef.current.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, tip.x - w / 2));
    let top = tip.y - hh - 14;
    if (top < 8) top = tip.y + 18;
    setPos({ left, top });
  }, [tip]);

  const sum = useMemo(() => {
    const sales = data.reduce((t, d) => t + d.sales, 0);
    const ad = data.reduce((t, d) => t + d.ad, 0);
    const orders = data.reduce((t, d) => t + d.orders, 0);
    const totals = data.map((d) => d.sales + d.ad);
    const bi = totals.indexOf(Math.max(...totals));
    return { sales, ad, orders, total: sales + ad, best: data[bi], bestTotal: totals[bi] ?? 0 };
  }, [data]);

  const t = tip ? data[tip.i] : null;
  const split = view === "split";

  return (
    <>
      <header className="am-card-h">
        <div>
          <h2 id="am-rev-h">Revenue, last 30 days</h2>
          <p className="am-insight">
            {sum.total > 0 ? (
              <>
                Ads brought in <b>{compactINR(sum.ad)}</b> and the store sold <b>{compactINR(sum.sales)}</b> across {sum.orders} orders.
              </>
            ) : (
              "No revenue recorded in the last 30 days yet."
            )}
          </p>
        </div>
        <div className="am-segctl" role="group" aria-label="Show revenue as">
          {(
            [
              ["stacked", "Stacked", "chart"],
              ["split", "Split", "layers"],
              ["table", "Table", "grid"],
            ] as const
          ).map(([v, l, ic]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              <Icon name={ic} />
              {l}
            </button>
          ))}
        </div>
      </header>

      {view === "stacked" ? (
        <ul className="am-legend" aria-label="Legend">
          <li>
            <i className="a" />
            Ad revenue
          </li>
          <li>
            <i className="s" />
            Product sales
          </li>
          <li className="am-legend-note">Labels mark the best day and today</li>
        </ul>
      ) : null}

      {view === "table" ? (
        <div className="am-tscroll am-rev-table">
          <table className="am-table am-table-sm">
            <thead>
              <tr>
                <th>Day</th>
                <th className="r">Product sales</th>
                <th className="r">Orders</th>
                <th className="r">Ad revenue</th>
                <th className="r">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="nowrap">{dayLabel(d.date, true)}</td>
                  <td className="r num">{formatINR(d.sales)}</td>
                  <td className="r num">{d.orders}</td>
                  <td className="r num">{formatINR(d.ad)}</td>
                  <td className="r num">
                    <b>{formatINR(d.sales + d.ad)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>30 days</td>
                <td className="r">{formatINR(sum.sales)}</td>
                <td className="r">{sum.orders}</td>
                <td className="r">{formatINR(sum.ad)}</td>
                <td className="r">{formatINR(sum.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="am-chart-box" ref={box} onPointerLeave={() => setTip(null)}>
          {split ? (
            <div className="am-split">
              <div>
                <h3 className="am-split-h">
                  <i className="a" />
                  Ad revenue
                </h3>
                <Columns data={data} width={width} series={[AD]} plotH={110} label="Ad revenue per day, last 30 days" onTip={setTip} active={tip?.i ?? null} />
              </div>
              <div>
                <h3 className="am-split-h">
                  <i className="s" />
                  Product sales
                </h3>
                <Columns data={data} width={width} series={[SALES]} plotH={110} label="Product sales per day, last 30 days" onTip={setTip} active={tip?.i ?? null} />
              </div>
            </div>
          ) : (
            <Columns data={data} width={width} series={[AD, SALES]} plotH={width < 560 ? 190 : 240} label="Revenue per day for the last 30 days, ad revenue and product sales stacked" onTip={setTip} active={tip?.i ?? null} />
          )}
        </div>
      )}

      <dl className="am-rev-foot">
        <div>
          <dt>Ad share of revenue</dt>
          <dd>{sum.total ? `${((sum.ad / sum.total) * 100).toFixed(1)}%` : "—"}</dd>
          <small>last 30 days</small>
        </div>
        <div>
          <dt>Best day</dt>
          <dd>{sum.best && sum.bestTotal ? compactINR(sum.bestTotal) : "—"}</dd>
          <small>{sum.best && sum.bestTotal ? dayLabel(sum.best.date, true) : "no sales yet"}</small>
        </div>
        <div>
          <dt>30-day revenue</dt>
          <dd>{compactINR(sum.total)}</dd>
          <small>
            ≈ {compactINR(Math.round(sum.total / Math.max(1, data.length)))} a day
          </small>
        </div>
      </dl>

      {t ? (
        <div className="am-tip" role="tooltip" ref={tipRef} style={pos}>
          <div className="am-tip-t">{dayLabel(t.date, true)}</div>
          {split ? null : (
            <div className="am-tip-r">
              <span className="am-tip-k" />
              <b>{formatINR(t.sales + t.ad)}</b>
              <span className="am-tip-l">Total</span>
            </div>
          )}
          <div className="am-tip-r">
            <span className="am-tip-k a" />
            <b>{formatINR(t.ad)}</b>
            <span className="am-tip-l">Ad revenue</span>
          </div>
          <div className="am-tip-r">
            <span className="am-tip-k s" />
            <b>{formatINR(t.sales)}</b>
            <span className="am-tip-l">
              Product sales · {t.orders} order{t.orders === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
