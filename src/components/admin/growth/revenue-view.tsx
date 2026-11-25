/**
 * /admin/revenue body (server component). Data: getRevenueReport() — the same payload as GET /api/v1/admin/revenue.
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { compactNumber, formatINR } from "@/lib/money";
import { Card, DataTable, Delta, KpiCard, pct, type Column } from "@/components/admin/ui";
import type { CampaignRevenue, RevenueReport, SellerRevenue, SlotRevenue } from "@/server/admin/growth/revenue";
import { CellBar, Columns, dayLabel, FillMeter, RankBars, StackedColumns, weekdayLabel, type StackPoint } from "./charts";
import { ChartTableToggle } from "./view-toggle";
import { SlotLine } from "./bits";

const MODEL_LABEL: Record<string, string> = {
  DAY: "Per day (flat)",
  WEEK: "Per week (flat)",
  MONTH: "Per month (flat)",
  CPM: "Per 1,000 views (CPM)",
  CPC: "Per click (CPC)",
  CLIP: "Per coupon clip",
  BOX: "Per delivery box",
};
const PAGE_LABEL: Record<string, string> = {
  home: "Homepage",
  search: "Search",
  product: "Product pages",
  cart: "Cart",
  success: "Confirmation",
  brand: "Brand stores",
  offline: "Delivery box",
};

const change = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export function RevenueKpis({ r }: { r: RevenueReport }) {
  const t = r.totals;
  const p = r.previous;
  const vs = `vs previous ${r.days} days`;
  const potentialForRange = (r.potentialMonthly / 30) * r.days;
  return (
    <section className="am-kpis" aria-label="Key numbers">
      <KpiCard
        hero
        label={`Total revenue · last ${r.days} days`}
        value={formatINR(t.total)}
        delta={
          p.ad > 0 || t.ad === 0 ? (
            <Delta value={change(t.total, p.total)} suffix="%" label={vs} />
          ) : (
            <Delta value={null} label={`ad delivery data starts ${r.daily.find((d) => d.impressions > 0) ? dayLabel(r.daily.find((d) => d.impressions > 0)!.date) : "in this period"}`} />
          )
        }
      >
        <div className="am-seg" role="img" aria-label={`Product sales ${formatINR(t.sales)} (${pct(1 - t.adShare)}), ad revenue ${formatINR(t.ad)} (${pct(t.adShare)})`}>
          <i className="s" style={{ flex: Math.max(t.sales, t.total * 0.004) }} />
          <i className="a" style={{ flex: Math.max(t.ad, t.total * 0.004) }} />
        </div>
        <ul className="am-seg-lg">
          <li>
            <i className="s" />
            Product sales <b>{formatINR(t.sales)}</b>
          </li>
          <li>
            <i className="a" />
            Ad revenue <b>{formatINR(t.ad)}</b>
          </li>
        </ul>
      </KpiCard>
      <KpiCard
        label="Ad revenue"
        value={formatINR(t.ad)}
        delta={<Delta value={change(t.ad, p.ad)} suffix="%" label={p.ad ? vs : "no earlier data"} />}
        sub={`${pct(Math.min(1, potentialForRange ? t.ad / potentialForRange : 0))} of ${formatINR(Math.round(potentialForRange))} full-occupancy potential`}
      >
        <div className="am-meter am-meter-pz" role="img" aria-label={`${pct(potentialForRange ? t.ad / potentialForRange : 0)} of potential`} style={{ "--p": Math.min(1, potentialForRange ? t.ad / potentialForRange : 0).toFixed(3) } as CSSProperties}>
          <i />
        </div>
      </KpiCard>
      <KpiCard
        label="Product sales"
        value={formatINR(t.sales)}
        delta={<Delta value={change(t.sales, p.sales)} suffix="%" label={vs} />}
        sub={
          <>
            <b>{t.orders.toLocaleString("en-IN")}</b> orders · avg <b>{formatINR(t.aov)}</b>
          </>
        }
      />
      <KpiCard
        label="Ad impressions"
        value={compactNumber(t.impressions)}
        delta={<Delta value={change(t.impressions, p.impressions)} suffix="%" label={vs} />}
        sub={
          <>
            <b>{compactNumber(t.clicks)}</b> clicks · <b>{pct(t.ctr, 2)}</b> CTR · eCPM <b>{formatINR(t.ecpm)}</b>
          </>
        }
      />
      <KpiCard
        label="Seller commission earned"
        value={formatINR(t.commissionEarned)}
        delta={<Delta value={change(t.sellerGmv, p.sellerGmv)} suffix="%" label="seller GMV vs previous" />}
        sub={
          <>
            on <b>{formatINR(t.sellerGmv)}</b> seller GMV · <b>{formatINR(t.commissionAccrued)}</b> accrued
          </>
        }
      />
    </section>
  );
}

export function DailyRevenueCard({ r }: { r: RevenueReport }) {
  const points: StackPoint[] = r.daily.map((d) => ({
    key: d.date,
    label: dayLabel(d.date),
    full: weekdayLabel(d.date),
    a: d.ad,
    s: d.sales,
    now: d.date === r.end,
    extra: [
      ["Orders", d.orders.toLocaleString("en-IN"), ""],
      ["Impressions", d.impressions.toLocaleString("en-IN"), ""],
    ],
  }));
  const best = r.daily.reduce((b, d) => (d.ad + d.sales > b.ad + b.sales ? d : b), r.daily[0]);
  const statDays = r.lastStatDate ? r.daily.filter((d) => d.date <= r.lastStatDate!).length : 0;
  const avgAd = statDays ? Math.round(r.totals.ad / statDays) : 0;
  const rows = [...r.daily].reverse();
  const cols: Column<(typeof r.daily)[number]>[] = [
    { key: "d", label: "Date", main: true, render: (d) => weekdayLabel(d.date) },
    { key: "a", label: "Ad revenue", align: "right", render: (d) => <span className="num">{formatINR(d.ad)}</span> },
    { key: "s", label: "Product sales", align: "right", render: (d) => <span className="num">{formatINR(d.sales)}</span> },
    { key: "t", label: "Total", align: "right", render: (d) => <b className="num">{formatINR(d.ad + d.sales)}</b> },
    { key: "o", label: "Orders", align: "right", render: (d) => <span className="num">{d.orders}</span> },
    { key: "i", label: "Impressions", align: "right", render: (d) => <span className="num">{d.impressions.toLocaleString("en-IN")}</span> },
    { key: "c", label: "CTR", align: "right", render: (d) => <span className="num">{d.impressions ? pct(d.clicks / d.impressions, 2) : "—"}</span> },
  ];
  return (
    <Card
      title="Ad revenue vs product sales, day by day"
      sub={
        <span className="am-insight">
          Ads brought in <b>{pct(r.totals.adShare, 1)}</b> of revenue over the last {r.days} days
          {r.lastStatDate && r.lastStatDate < r.end ? <> · ad delivery is counted up to <b>{dayLabel(r.lastStatDate)}</b> (the daily stats job runs overnight)</> : null}
        </span>
      }
    >
      <ChartTableToggle
        label="Daily revenue"
        legend={
          <ul className="am-legend" aria-label="Legend" style={{ margin: 0 }}>
            <li>
              <i className="a" />
              Ad revenue
            </li>
            <li>
              <i className="s" />
              Product sales
            </li>
            <li className="am-legend-note">Label = best day</li>
          </ul>
        }
        chart={<StackedColumns points={points} aria={`Revenue per day for the last ${r.days} days, split into ad revenue and product sales`} />}
        table={<DataTable rows={rows} columns={cols} rowKey={(d) => d.date} small minWidth={720} />}
      />
      <dl className="ag-chart-foot">
        <div>
          <dt>Best day</dt>
          <dd>{best ? formatINR(best.ad + best.sales) : "—"}</dd>
          <small>{best ? weekdayLabel(best.date) : ""}</small>
        </div>
        <div>
          <dt>Average ad revenue</dt>
          <dd>{formatINR(avgAd)}</dd>
          <small>per day with delivery data</small>
        </div>
        <div>
          <dt>Fill rate (weighted)</dt>
          <dd>{pct(r.weightedFill)}</dd>
          <small>share of paid positions sold</small>
        </div>
        <div>
          <dt>House impressions</dt>
          <dd>{compactNumber(r.totals.houseImpressions)}</dd>
          <small>your own promos in unsold space · ₹0</small>
        </div>
      </dl>
    </Card>
  );
}

export function SlotRevenueCard({ r }: { r: RevenueReport }) {
  const rows = [...r.bySlot].sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(1, ...rows.map((s) => s.revenue));
  const cols: Column<SlotRevenue>[] = [
    {
      key: "slot",
      label: "Slot",
      main: true,
      render: (s) => <SlotLine code={s.code} name={s.name} sub={`${PAGE_LABEL[s.page] ?? s.page} · ${s.pricingModel}${s.isActive ? "" : " · paused"}`} href={`/admin/ads/${s.code}`} />,
    },
    { key: "rev", label: "Revenue", render: (s) => <CellBar value={s.revenue} max={max} text={formatINR(s.revenue)} /> },
    { key: "imp", label: "Impressions", align: "right", render: (s) => <span className="num">{compactNumber(s.impressions)}</span> },
    { key: "ctr", label: "CTR", align: "right", render: (s) => <span className="num">{s.impressions ? pct(s.ctr, 2) : "—"}</span> },
    { key: "ecpm", label: "eCPM", align: "right", render: (s) => <span className="num">{s.impressions && s.revenue ? formatINR(s.ecpm) : "—"}</span> },
    { key: "fill", label: "Fill rate", render: (s) => <FillMeter value={s.fill} label={`${s.code} fill rate ${pct(s.fill)}`} /> },
  ];
  return (
    <Card title="Revenue by ad slot" sub={`All ${r.bySlot.length} placements · fill = average share of positions sold on each day`} actions={<Link className="link" href="/admin/ads">Ads Manager</Link>}>
      <DataTable rows={rows} columns={cols} rowKey={(s) => s.code} small minWidth={760} />
    </Card>
  );
}

export function ModelCard({ r }: { r: RevenueReport }) {
  const total = Math.max(1, r.byModel.reduce((t, m) => t + m.revenue, 0));
  return (
    <Card title="Revenue by pricing model" sub="Flat-rate placements vs pay-per-delivery">
      <RankBars
        items={r.byModel.map((m) => ({
          key: m.model,
          label: <span>{MODEL_LABEL[m.model] ?? m.model}</span>,
          ariaLabel: MODEL_LABEL[m.model] ?? m.model,
          value: m.revenue,
          valueText: formatINR(m.revenue),
          side: `${pct(m.revenue / total)} · ${m.campaigns} campaign${m.campaigns === 1 ? "" : "s"}`,
          tip: {
            title: MODEL_LABEL[m.model] ?? m.model,
            rows: [
              ["Revenue", formatINR(m.revenue), "a"],
              ["Share", pct(m.revenue / total, 1), ""],
              ["Impressions", m.impressions.toLocaleString("en-IN"), ""],
              ["Clicks", m.clicks.toLocaleString("en-IN"), ""],
            ],
          },
        }))}
        empty="No paid delivery in this period"
      />
    </Card>
  );
}

export function AdvertiserCard({ r }: { r: RevenueReport }) {
  const top = r.byAdvertiser.slice(0, 10);
  return (
    <Card title="Top advertisers" sub={`${r.byAdvertiser.length} brands paid for delivery in this period`} actions={<Link className="link" href="/admin/advertisers">All</Link>}>
      <RankBars
        items={top.map((a) => ({
          key: a.id ?? a.name,
          label: a.id ? (
            <Link href={`/admin/advertisers/${a.id}`} className="ag-link" style={{ fontWeight: 500, color: "inherit" }}>
              {a.name}
            </Link>
          ) : (
            <span>{a.name}</span>
          ),
          ariaLabel: a.name,
          value: a.revenue,
          valueText: formatINR(a.revenue),
          side: `${a.campaigns} campaign${a.campaigns === 1 ? "" : "s"}`,
          tip: {
            title: a.name,
            rows: [
              ["Revenue", formatINR(a.revenue), "a"],
              ["Impressions", a.impressions.toLocaleString("en-IN"), ""],
              ["CTR", a.impressions ? pct(a.clicks / a.impressions, 2) : "—", ""],
            ],
          },
        }))}
        empty="No paid campaigns delivered in this period"
      />
    </Card>
  );
}

export function TopCampaignsCard({ r }: { r: RevenueReport }) {
  const rows = r.topCampaigns.slice(0, 10);
  const cols: Column<CampaignRevenue>[] = [
    {
      key: "c",
      label: "Campaign",
      main: true,
      render: (c) => (
        <Link href={`/admin/campaigns/${c.id}`} className="am-cname" style={{ minWidth: 0 }}>
          <span>
            <b>{c.headline}</b>
            <small>
              {c.isHouse ? "The Big Brands (house)" : (c.advertiser ?? c.brandName ?? "—")} · {c.code}
            </small>
          </span>
        </Link>
      ),
    },
    { key: "s", label: "Slot", render: (c) => <SlotLine code={c.slotCode} name={c.slotName} /> },
    { key: "r", label: "Revenue", align: "right", render: (c) => <b className="num">{c.isHouse ? "House" : formatINR(c.revenue)}</b> },
    { key: "i", label: "Impr.", align: "right", render: (c) => <span className="num">{compactNumber(c.impressions)}</span> },
    { key: "ctr", label: "CTR", align: "right", render: (c) => <span className="num">{c.impressions ? pct(c.ctr, 2) : "—"}</span> },
  ];
  return (
    <Card title="Top campaigns" sub="By revenue in this period" actions={<Link className="link" href="/admin/campaigns">All campaigns</Link>}>
      <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} small minWidth={640} empty="No campaigns delivered in this period" />
    </Card>
  );
}

export function SellerCard({ r }: { r: RevenueReport }) {
  const cols: Column<SellerRevenue>[] = [
    {
      key: "n",
      label: "Seller",
      main: true,
      render: (s) => (
        <Link className="ag-link" href={`/admin/sellers/${s.id}`} style={{ color: "inherit" }}>
          <b>{s.name}</b>
          <span className="ag-sub">{s.commissionPct}% commission{s.status !== "APPROVED" ? ` · ${s.status.toLowerCase()}` : ""}</span>
        </Link>
      ),
    },
    { key: "g", label: "GMV", align: "right", render: (s) => <b className="num">{formatINR(s.gmv)}</b> },
    { key: "u", label: "Units", align: "right", render: (s) => <span className="num">{s.items}</span> },
    { key: "a", label: "Commission accrued", align: "right", render: (s) => <span className="num">{formatINR(s.commissionAccrued)}</span> },
    { key: "e", label: "Earned (delivered)", align: "right", render: (s) => <span className="num">{formatINR(s.commissionEarned)}</span> },
  ];
  const t = r.totals;
  return (
    <Card title="Seller marketplace" sub="Gross merchandise value sold by third-party sellers and the commission it earns" actions={<Link className="link" href="/admin/payouts">Payouts &amp; ledger</Link>}>
      <DataTable
        rows={r.sellers}
        columns={cols}
        rowKey={(s) => s.id}
        small
        minWidth={620}
        empty="No seller sales in this period"
        footer={
          r.sellers.length > 1 ? (
            <tr>
              <td>Total</td>
              <td className="r num">{formatINR(t.sellerGmv)}</td>
              <td className="r num">{r.sellers.reduce((x, s) => x + s.items, 0)}</td>
              <td className="r num">{formatINR(t.commissionAccrued)}</td>
              <td className="r num">{formatINR(t.commissionEarned)}</td>
            </tr>
          ) : undefined
        }
      />
    </Card>
  );
}

/** Impressions per day (single series) for the delivery card. */
export function DeliveryCard({ r }: { r: RevenueReport }) {
  return (
    <Card title="Ad delivery" sub={`Impressions served per day · ${compactNumber(r.totals.impressions)} total, ${pct(r.totals.ctr, 2)} click-through`}>
      <Columns
        points={r.daily.map((d) => ({
          key: d.date,
          label: dayLabel(d.date),
          full: weekdayLabel(d.date),
          v: d.impressions,
          now: d.date === r.end,
          extra: [
            ["Clicks", d.clicks.toLocaleString("en-IN"), ""],
            ["CTR", d.impressions ? pct(d.clicks / d.impressions, 2) : "—", ""],
          ],
        }))}
        format="num"
        series="Impressions"
        tone="pz"
        aria={`Ad impressions per day, last ${r.days} days`}
        size="half"
      />
    </Card>
  );
}
