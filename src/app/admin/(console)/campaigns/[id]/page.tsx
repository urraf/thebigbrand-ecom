import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { compactNumber, formatINR } from "@/lib/money";
import {
  Card,
  DataTable,
  fmtDate,
  fmtDateTime,
  KeyValues,
  PageHeader,
  pct,
  SkeletonPage,
  StatCard,
  StatGrid,
  StatusPill,
  type Column,
} from "@/components/admin/ui";
import { GIcon, StatePill, WhereItRuns } from "@/components/admin/growth/bits";
import { CampaignActions } from "@/components/admin/growth/campaign-actions";
import { CampaignEditor } from "@/components/admin/growth/campaign-editor";
import { PaymentPill } from "@/components/admin/growth/campaign-view";
import { ChartTips } from "@/components/admin/growth/chart-tips";
import { Columns, dayLabel, weekdayLabel, type ColPoint } from "@/components/admin/growth/charts";
import { editorInitialFrom } from "@/components/admin/growth/editor-initial";
import { ChartTableToggle, MetricTabs } from "@/components/admin/growth/view-toggle";
import { STOREFRONT_RENDERED, StorefrontPreview } from "@/components/admin/growth/storefront-preview";
import { editorOptions, getCampaign, type CampaignDetail } from "@/server/admin/growth/campaigns";
import { SlotSiteLink } from "@/components/admin/growth/view-on-site";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Campaign" };
/** Detail pages read the session + URL params at request time; the console shell's URL-derived crumb blocks too. */
export const instant = false;

type Params = { id: string };

export default function CampaignPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Campaign" back={{ href: "/admin/campaigns", label: "Campaigns" }} />
          <SkeletonPage stats={4} rows={8} />
        </>
      }
    >
      <CampaignContent params={params} />
    </Suspense>
  );
}

type Day = CampaignDetail["daily"][number];

async function CampaignContent({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/campaigns/${id}`);
  const [c, opts] = await Promise.all([getCampaign(id), editorOptions()]);
  if (!c) notFound();

  const who = c.isHouse ? "The Big Brands (house)" : (c.advertiser?.name ?? c.sellerName ?? c.brand?.name ?? "—");
  const ecpm = c.impressions ? (c.spent / c.impressions) * 1000 : 0;
  const pts = (pick: (d: Day) => number): ColPoint[] =>
    c.daily.map((d) => ({
      key: d.date,
      label: dayLabel(d.date),
      full: weekdayLabel(d.date),
      v: pick(d),
      extra: [
        ["Impressions", d.impressions.toLocaleString("en-IN"), ""],
        ["Clicks", d.clicks.toLocaleString("en-IN"), ""],
        ["Spend", formatINR(d.spend), ""],
      ],
    }));
  const dayCols: Column<Day>[] = [
    { key: "d", label: "Date", main: true, render: (d) => weekdayLabel(d.date) },
    { key: "i", label: "Impressions", align: "right", render: (d) => <span className="num">{d.impressions.toLocaleString("en-IN")}</span> },
    { key: "c", label: "Clicks", align: "right", render: (d) => <span className="num">{d.clicks.toLocaleString("en-IN")}</span> },
    { key: "ctr", label: "CTR", align: "right", render: (d) => <span className="num">{d.impressions ? pct(d.clicks / d.impressions, 2) : "—"}</span> },
    { key: "s", label: "Spend", align: "right", render: (d) => <b className="num">{formatINR(d.spend)}</b> },
    { key: "e", label: "eCPM", align: "right", render: (d) => <span className="num">{d.impressions && d.spend ? formatINR((d.spend / d.impressions) * 1000) : "—"}</span> },
  ];
  const readOnly = c.status === "ENDED";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/campaigns", label: "Campaigns" }}
        title={c.name}
        badge={<StatePill tone={c.tone} label={c.stateLabel} />}
        sub={
          <>
            {c.code} · {who} · slot{" "}
            <Link className="link" href={`/admin/ads/${c.slot.code}`}>
              {c.slot.code} {c.slot.name}
            </Link>{" "}
            · {fmtDate(c.startsAt)} → {fmtDate(c.endsAt)}
          </>
        }
        actions={
          <>
            {c.viewUrl && (c.state === "LIVE" || c.state === "SCHEDULED") ? (
              <SlotSiteLink className="btn btn-ghost btn-sm" href={c.viewUrl}>
                <GIcon name="ext" />
                View on site
              </SlotSiteLink>
            ) : null}
            <CampaignActions id={c.id} code={c.code} status={c.status} name={c.name} deletable={c.impressions === 0 && c.spent === 0 && c.payments.length === 0 && c.daily.every((d) => d.impressions === 0)} />
          </>
        }
      />

      {c.status === "REJECTED" && c.rejectionReason ? (
        <div className="ag-reason" role="note">
          <b>Rejected</b>
          {c.rejectionReason}
        </div>
      ) : null}
      {c.state === "SLOT_PAUSED" ? (
        <div className="ag-note ag-note-warn">
          <GIcon name="pause" />
          <div>
            Approved, but slot <b>{c.slot.code}</b> is paused in <Link className="link" href="/admin/ads">Ads Manager</Link> — this creative is not showing anywhere right now.
          </div>
        </div>
      ) : null}
      {c.state === "BUDGET_SPENT" ? (
        <div className="ag-note ag-note-warn">
          <GIcon name="rupee" />
          <div>
            The {formatINR(c.budget)} budget is used up, so it stopped serving. Raise the budget cap below to resume delivery.
          </div>
        </div>
      ) : null}

      <StatGrid label="Campaign results">
        <StatCard label="Impressions" value={compactNumber(c.impressions)} sub={c.days ? `Day ${c.elapsed} of ${c.days}` : undefined} meter={c.days ? c.elapsed / c.days : undefined} />
        <StatCard label="Clicks" value={c.clicks.toLocaleString("en-IN")} sub={`${c.impressions ? pct(c.ctr, 2) : "—"} click-through rate`} />
        <StatCard label={c.isHouse ? "Spend (house — not billed)" : "Spent"} value={formatINR(c.spent)} sub={c.isHouse ? "House promos are free" : `${c.bookedValue ? `of ${formatINR(c.bookedValue)} booked` : "no cap"} · eCPM ${formatINR(ecpm)}`} />
        <StatCard label="Payment" value={<PaymentPill status={c.paymentStatus} />} sub={c.payments.length ? `${c.payments.length} payment${c.payments.length === 1 ? "" : "s"} recorded` : c.isHouse ? "Waived for house campaigns" : "No payment recorded yet"} />
      </StatGrid>

      <CampaignEditor
        mode="edit"
        initial={editorInitialFrom(c)}
        options={opts}
        readOnly={readOnly}
        readOnlyReason="This campaign has ended. Duplicate it to run the same creative again."
      />

      {STOREFRONT_RENDERED.has(c.slot.code) ? (
        <Card
          title="On the storefront"
          sub="The saved creative rendered by the store's own components, exactly as shoppers see it in its slot (links disabled here). Save to refresh."
          actions={c.viewUrl ? <a className="link" href={c.viewUrl} target="_blank" rel="noopener">Open the {c.slot.pageLabel.toLowerCase()}</a> : undefined}
        >
          <Suspense fallback={<div className="am-sk am-sk-card" style={{ height: 200 }} />}>
            <StorefrontPreview c={c} />
          </Suspense>
        </Card>
      ) : null}

      <div className="am-grid">
        <div className="am-span8">
          <Card title="Daily delivery" sub={c.daily.length ? `${fmtDate(c.daily[0].date)} → ${fmtDate(c.daily[c.daily.length - 1].date)}` : "Stats appear after the first day of delivery"}>
            <ChartTableToggle
              label="Daily delivery"
              chart={
                <MetricTabs
                  label="Metric"
                  items={[
                    { key: "i", label: "Impressions", node: <Columns size="wide" points={pts((d) => d.impressions)} format="num" series="Impressions" aria={`${c.code} impressions per day`} /> },
                    { key: "c", label: "Clicks", node: <Columns size="wide" points={pts((d) => d.clicks)} format="num" series="Clicks" aria={`${c.code} clicks per day`} /> },
                    { key: "s", label: "Spend", node: <Columns size="wide" points={pts((d) => d.spend)} format="inr" series="Spend" aria={`${c.code} spend per day`} /> },
                    { key: "r", label: "CTR", node: <Columns size="wide" points={pts((d) => (d.impressions ? d.clicks / d.impressions : 0))} format="pct" series="CTR" aria={`${c.code} click-through rate per day`} /> },
                  ]}
                />
              }
              table={<DataTable rows={[...c.daily].reverse()} columns={dayCols} rowKey={(d) => d.date} small minWidth={600} empty="No delivery yet" />}
            />
          </Card>
        </div>
        <div className="am-span4 ag-stack">
          <Card title="Placement">
            <WhereItRuns code={c.slot.code} name={c.slot.name} page={c.slot.page} pageLabel={c.slot.pageLabel} format={c.slot.format} rateLabel={c.rateLabel} />
          </Card>
          <Card title="Details">
            <KeyValues
              rows={[
                ["Code", <span className="ag-mono" key="c">{c.code}</span>],
                ["Status", <StatusPill key="s" kind="campaign" status={c.status} />],
                ["Advertiser", c.advertiser ? <Link className="link" key="a" href={`/admin/advertisers/${c.advertiser.id}`}>{c.advertiser.name}</Link> : c.isHouse ? "The Big Brands (house)" : "—"],
                c.sellerId ? ["Seller", <Link className="link" key="se" href={`/admin/sellers/${c.sellerId}`}>{c.sellerName ?? "Seller"}</Link>] : null,
                ["Created", `${fmtDateTime(c.createdAt)}${c.createdBy ? ` · ${c.createdBy}` : ""}`],
                ["Approved", c.approvedAt ? `${fmtDateTime(c.approvedAt)}${c.approvedBy ? ` · ${c.approvedBy}` : ""}` : "—"],
                ["Booked value", c.isHouse ? "House (₹0)" : formatINR(c.bookedValue)],
              ]}
            />
          </Card>
          <Card title="Payments" sub={c.isHouse ? "House campaigns are not billed" : "Online payments from the Advertise page / seller portal"}>
            {c.payments.length ? (
              <ul className="am-att">
                {c.payments.map((p) => (
                  <li key={p.id}>
                    <span className="am-att-ic">
                      <GIcon name="card" />
                    </span>
                    <span className="am-att-t">
                      <b>{formatINR(p.amount)}</b>
                      <small>
                        {p.provider} · {fmtDateTime(p.createdAt)}
                        {p.providerPaymentId ? ` · ${p.providerPaymentId}` : ""}
                      </small>
                    </span>
                    <StatusPill kind="payment" status={p.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="am-muted" style={{ fontSize: 13 }}>
                No payments recorded. Mark the campaign Paid / Invoiced in Schedule &amp; billing once settled offline.
              </p>
            )}
          </Card>
        </div>
      </div>
      <ChartTips />
    </>
  );
}
