import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { compactNumber, formatINR } from "@/lib/money";
import {
  ApiSwitch,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  pct,
  Pill,
  SkeletonPage,
  StatCard,
  StatGrid,
  type Column,
} from "@/components/admin/ui";
import { CampaignName, flightLabel, GIcon, StatePill, ViewOnSite, WhereItRuns } from "@/components/admin/growth/bits";
import { Columns, dayLabel, weekdayLabel } from "@/components/admin/growth/charts";
import { ChartTips } from "@/components/admin/growth/chart-tips";
import { SlotSettingsForm } from "@/components/admin/growth/slot-controls";
import { MetricTabs } from "@/components/admin/growth/view-toggle";
import { getSlotDetail, type SlotCampaignRow } from "@/server/admin/growth/slots";
import { db } from "@/lib/db";
import { SlotSiteLink } from "@/components/admin/growth/view-on-site";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Ad slot" };
/** Detail pages read the session + URL params at request time; the console shell's URL-derived crumb blocks too. */
export const instant = false;

type Params = { code: string };

export default function SlotPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Ad slot" back={{ href: "/admin/ads", label: "Ads Manager" }} />
          <SkeletonPage stats={4} rows={6} />
        </>
      }
    >
      <SlotContent params={params} />
    </Suspense>
  );
}

async function SlotContent({ params }: { params: Promise<Params> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  await requireAdminPage(`/admin/ads/${code}`);
  const d = await getSlotDetail(code);
  if (!d) notFound();
  const { slot, totals, campaigns, daily } = d;
  const brands = await db.adCampaign.findMany({
    where: { id: { in: campaigns.map((c) => c.id) } },
    select: { id: true, brand: { select: { name: true, word: true, sub: true, color: true, font: true, fontWeight: true, textTransform: true, letterSpacing: true, italic: true, logoUrl: true } } },
  });
  const brandOf = new Map(brands.map((b) => [b.id, b.brand]));

  const cols: Column<SlotCampaignRow>[] = [
    {
      key: "c",
      label: "Campaign",
      main: true,
      render: (c) => (
        <CampaignName
          href={`/admin/campaigns/${c.id}`}
          brand={brandOf.get(c.id) ?? null}
          isHouse={c.isHouse}
          title={c.headline}
          sub={`${c.isHouse ? "The Big Brands · house" : (c.advertiser ?? c.brandName ?? "—")} · ${c.code}`}
        />
      ),
    },
    { key: "st", label: "Status", render: (c) => <StatePill tone={c.tone} label={c.stateLabel} /> },
    {
      key: "d",
      label: "Flight",
      render: (c) => (
        <span className="nowrap">{flightLabel(c.startsAt, c.endsAt)}</span>
      ),
    },
    { key: "pr", label: "Priority", align: "right", hideMobile: true, render: (c) => <span className="num">{c.priority} · w{c.weight}</span> },
    { key: "sp", label: "Spent", align: "right", render: (c) => <b className="num">{c.isHouse ? "House" : formatINR(c.spent)}</b> },
    {
      key: "res",
      label: "Results",
      align: "right",
      render: (c) => (
        <span className="num nowrap">
          {compactNumber(c.impressions)} impr.
          <span className="ag-sub">{c.impressions ? pct(c.clicks / c.impressions, 2) : "—"} CTR</span>
        </span>
      ),
    },
  ];

  const pts = (pick: (x: (typeof daily)[number]) => number) =>
    daily.map((x) => ({
      key: x.date,
      label: dayLabel(x.date),
      full: weekdayLabel(x.date),
      v: pick(x),
      extra: [["Campaigns delivering", String(x.campaigns), ""] as [string, string, ""]],
    }));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/ads", label: "Ads Manager" }}
        title={
          <>
            <span className="am-sid" style={{ fontSize: 15, height: 28, minWidth: 48 }}>
              {slot.code}
            </span>
            {slot.name}
          </>
        }
        badge={slot.isActive ? <Pill tone="live">Live</Pill> : <Pill tone="packed">Paused</Pill>}
        sub={`${slot.pageLabel} · ${slot.format} · ${slot.size} · ${slot.rateLabel}`}
        actions={
          <>
            <ApiSwitch
              checked={slot.isActive}
              url={`/api/v1/admin/ads/${slot.code}`}
              field="isActive"
              label={`${slot.code} ${slot.isActive ? "live, press to pause" : "paused, press to resume"}`}
              showState
              onText="Live"
              offText="Paused"
              successOn={`${slot.code} is live again`}
              successOff={`${slot.code} paused — hidden from the website & apps`}
            />
            {slot.viewUrl ? (
              <SlotSiteLink className="btn btn-ghost btn-sm" href={slot.viewUrl}>
                <GIcon name="ext" />
                View on site
              </SlotSiteLink>
            ) : null}
            <Link className="btn btn-dark btn-sm" href={`/admin/campaigns/new?slot=${slot.code}`}>
              <GIcon name="plus" />
              New campaign here
            </Link>
          </>
        }
      />
      <StatGrid label={`${slot.code} summary`}>
        <StatCard label="Revenue · last 30 days" value={formatINR(totals.revenue30)} sub={`${formatINR(slot.potentialMonthly)} potential / month`} />
        <StatCard label="Impressions · 30 days" value={compactNumber(totals.impressions30)} sub={`${compactNumber(totals.clicks30)} clicks · ${totals.impressions30 ? pct(totals.clicks30 / totals.impressions30, 2) : "—"} CTR`} />
        <StatCard label="Sold now" value={pct(totals.fill)} meter={totals.fill} sub={`${totals.paidLive} paid of ${slot.positions} position${slot.positions === 1 ? "" : "s"}${totals.liveNow > totals.paidLive ? " · house promo in the rest" : ""}`} />
        <StatCard
          tone={totals.pending ? "cta" : undefined}
          label="Awaiting approval"
          value={totals.pending}
          sub={totals.pending ? <Link className="link" href={`/admin/campaigns?slot=${slot.code}&state=PENDING_REVIEW`}>Review now →</Link> : "Nothing waiting"}
        />
      </StatGrid>

      {!slot.isActive ? (
        <div className="ag-note ag-note-warn">
          <GIcon name="pause" />
          <div>
            <b>This slot is paused.</b> None of its {totals.liveNow} approved campaign{totals.liveNow === 1 ? "" : "s"} are showing on the website or apps. Flat-priced
            campaigns are not billed while the slot is off.
          </div>
        </div>
      ) : null}

      <div className="am-grid">
        <div className="am-span8">
          <Card title="Daily delivery" sub="Last 30 days, all campaigns in this slot">
            <MetricTabs
              label="Metric"
              items={[
                { key: "spend", label: "Revenue", node: <Columns points={pts((x) => x.spend)} format="inr" series="Revenue" aria={`${slot.code} revenue per day`} size="wide" /> },
                { key: "impr", label: "Impressions", node: <Columns points={pts((x) => x.impressions)} format="num" series="Impressions" aria={`${slot.code} impressions per day`} size="wide" /> },
                { key: "clicks", label: "Clicks", node: <Columns points={pts((x) => x.clicks)} format="num" series="Clicks" aria={`${slot.code} clicks per day`} size="wide" /> },
              ]}
            />
          </Card>
        </div>
        <div className="am-span4 ag-stack">
          <Card title="Placement">
            <WhereItRuns code={slot.code} name={slot.name} page={slot.page} pageLabel={slot.pageLabel} format={slot.format} rateLabel={slot.rateLabel} />
            <p className="am-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              {slot.description || "Every creative in this slot carries the “Ad” label (house promos say “The Big Brands”)."}{" "}
              <ViewOnSite href={slot.viewUrl} />
            </p>
          </Card>
          <Card title="Slot settings" sub={`Pricing model: ${slot.pricingModel}`}>
            <SlotSettingsForm
              code={slot.code}
              model={slot.pricingModel}
              initial={{ rate: slot.rate, positions: slot.positions, potentialMonthly: slot.potentialMonthly, bookable: slot.bookable, description: slot.description }}
            />
          </Card>
        </div>
      </div>

      <Card title="Campaigns in this slot" sub={`${campaigns.length} total · live first`} actions={<Link className="link" href={`/admin/campaigns?slot=${slot.code}`}>Open in Campaigns</Link>}>
        <DataTable
          rows={campaigns}
          columns={cols}
          rowKey={(c) => c.id}
          className="ag-ctable"
          minWidth={860}
          empty={
            <EmptyState icon="megaphone" title="No campaigns yet" action={<Link className="btn btn-dark btn-sm" href={`/admin/campaigns/new?slot=${slot.code}`}>Create one</Link>}>
              Brands can book this slot from the Advertise page{slot.bookable ? "" : " once self-serve booking is switched on"}.
            </EmptyState>
          }
        />
      </Card>
      <ChartTips />
    </>
  );
}
