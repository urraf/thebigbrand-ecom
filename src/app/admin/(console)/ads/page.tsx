import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import {
  ApiSwitch,
  Card,
  DataTable,
  FilterChips,
  flatParams,
  PageHeader,
  pct,
  SkeletonPage,
  StatCard,
  StatGrid,
  type Column,
  type SearchParamsInput,
} from "@/components/admin/ui";
import { GIcon, ViewOnSite } from "@/components/admin/growth/bits";
import { FillMeter } from "@/components/admin/growth/charts";
import { RateEditor } from "@/components/admin/growth/slot-controls";
import { listSlots, PAGE_LABEL, type SlotRow } from "@/server/admin/growth/slots";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Ads Manager" };

const PAGE_ORDER = ["home", "search", "product", "cart", "success", "brand", "offline"];

export default function AdsManagerPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader
        title="Ads Manager"
        sub="Your ad inventory and rate card. Pause a slot and it disappears from the website & apps instantly."
        actions={
          <>
            <a className="btn btn-ghost btn-sm" href="/advertise" target="_blank" rel="noopener">
              <GIcon name="ext" />
              Rate card
            </a>
            <a className="btn btn-ghost btn-sm" href="/api/v1/admin/revenue/export?days=30&type=slots" download>
              <GIcon name="download" />
              Export
            </a>
            <Link className="btn btn-dark btn-sm" href="/admin/campaigns/new">
              <GIcon name="plus" />
              New campaign
            </Link>
          </>
        }
      />
      <Suspense fallback={<SkeletonPage stats={4} rows={12} />}>
        <AdsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AdsContent({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/ads");
  const params = flatParams(await searchParams);
  const { slots, summary } = await listSlots();
  const where = PAGE_ORDER.includes(params.in ?? "") ? params.in! : "";
  const rows = where ? slots.filter((s) => s.page === where) : slots;
  const counts = slots.reduce<Record<string, number>>((m, s) => ((m[s.page] = (m[s.page] ?? 0) + 1), m), {});

  const cols: Column<SlotRow>[] = [
    {
      key: "slot",
      label: "Slot",
      main: true,
      render: (s) => (
        <div className="am-slotn">
          <b className="am-sid">{s.code}</b>
          <span>
            <strong>
              <Link href={`/admin/ads/${s.code}`}>{s.name}</Link>
            </strong>
            <small>{s.format}</small>
            {s.liveBrands.length ? (
              <small className="am-slot-camp">
                <GIcon name="megaphone" />
                {s.liveBrands.slice(0, 3).join(", ")}
                {s.liveBrands.length > 3 ? ` +${s.liveBrands.length - 3}` : ""} live
              </small>
            ) : s.houseLive ? (
              <small>House promo filling the space</small>
            ) : null}
            {s.pendingCount ? (
              <small className="am-slot-wait">
                <GIcon name="clock" />
                <Link href={`/admin/campaigns?slot=${s.code}&state=PENDING_REVIEW`}>{s.pendingCount} awaiting approval</Link>
              </small>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      key: "pg",
      label: "Page · size",
      render: (s) => (
        <>
          <span className="am-pg">{s.pageLabel}</span>
          <span className="am-size">{s.size}</span>
        </>
      ),
    },
    { key: "rate", label: "Rate", align: "right", className: "ag-keep", render: (s) => <RateEditor code={s.code} name={s.name} model={s.pricingModel} rate={s.rate} /> },
    {
      key: "fill",
      label: "Sold now",
      render: (s) => (
        <div>
          <FillMeter value={s.fill} label={`${s.code}: ${s.liveCount} of ${s.positions} positions sold`} />
          <span className="ag-sub">
            {s.liveCount > s.positions
              ? `${s.liveCount} campaigns rotate in ${s.positions}`
              : `${s.liveCount}/${s.positions} position${s.positions === 1 ? "" : "s"}`}
          </span>
        </div>
      ),
    },
    {
      key: "mtd",
      label: "Booked this month",
      align: "right",
      render: (s) => <b className="num">{formatINR(s.mtdRevenue)}</b>,
    },
    { key: "pot", label: "Potential / mo", align: "right", hideMobile: true, render: (s) => <span className="num am-muted">{formatINR(s.potentialMonthly)}</span> },
    {
      key: "st",
      label: "Status",
      className: "ag-keep",
      render: (s) => (
        <ApiSwitch
          checked={s.isActive}
          url={`/api/v1/admin/ads/${s.code}`}
          field="isActive"
          label={`${s.code} ${s.name}: ${s.isActive ? "live, press to pause" : "paused, press to resume"}`}
          showState
          onText="Live"
          offText="Paused"
          successOn={`${s.code} is live again on the website & apps`}
          successOff={`${s.code} paused — hidden from the website & apps`}
        />
      ),
    },
    {
      key: "go",
      label: "",
      className: "ag-keep",
      render: (s) => (
        <span className="ag-slot-links">
          <ViewOnSite href={s.viewUrl} label="View" aria={`View ${s.name} on the ${s.pageLabel}`} />
          <Link className="am-viewl" href={`/admin/ads/${s.code}`} aria-label={`${s.code} details`}>
            Details
            <GIcon name="chevRight" />
          </Link>
        </span>
      ),
    },
  ];

  const tMtd = rows.reduce((t, s) => t + s.mtdRevenue, 0);
  const tPot = rows.reduce((t, s) => t + s.potentialMonthly, 0);
  const tFill = tPot ? rows.reduce((t, s) => t + s.fill * s.potentialMonthly, 0) / tPot : 0;
  const tLive = rows.filter((s) => s.isActive).length;

  return (
    <>
      <StatGrid label="Ad inventory summary">
        <StatCard label="Booked this month" value={formatINR(summary.mtdRevenue)} sub={`1–${Number(summary.today.slice(8))} ${monthName(summary.today)} · all ${summary.slots} slots`} />
        <StatCard label="On track for" value={formatINR(summary.projectedMonth)} sub={`${pct(summary.potentialMonthly ? summary.projectedMonth / summary.potentialMonthly : 0)} of ${formatINR(summary.potentialMonthly)} monthly potential`} />
        <StatCard label="Inventory sold" value={pct(summary.weightedFill)} meter={summary.weightedFill} sub="paid positions live now, weighted by value" />
        <StatCard tone="cta" label="Unsold inventory" value={formatINR(summary.unsoldMonthly)} unit="/mo" sub={<a className="link" href="/advertise" target="_blank" rel="noopener">Share the rate card with brands →</a>} />
      </StatGrid>

      <Card
        title="Ad inventory"
        sub={
          <>
            <b>
              {summary.liveSlots} of {summary.slots}
            </b>{" "}
            slots are live. Click a rate to change it — running campaigns keep the rate they were sold at.
          </>
        }
      >
        <FilterChips
          basePath="/admin/ads"
          params={params}
          param="in"
          label="Filter by page"
          options={[{ value: "", label: "All pages", count: slots.length }, ...PAGE_ORDER.filter((p) => counts[p]).map((p) => ({ value: p, label: PAGE_LABEL[p], count: counts[p] }))]}
        />
        <DataTable
          rows={rows}
          columns={cols}
          rowKey={(s) => s.code}
          rowClassName={(s) => (s.isActive ? undefined : "is-off")}
          minWidth={1060}
          caption="Ad slots"
          footer={
            <tr>
              <td>
                Total · {rows.length} slot{rows.length === 1 ? "" : "s"}
              </td>
              <td />
              <td />
              <td>
                <FillMeter value={tFill} label={`Weighted fill ${pct(tFill)}`} />
              </td>
              <td className="r num">{formatINR(tMtd)}</td>
              <td className="r num am-c-hide">{formatINR(tPot)}</td>
              <td>{tLive} live</td>
              <td />
            </tr>
          }
        />
      </Card>
      <p className="am-muted" style={{ fontSize: 12.5 }}>
        Booked this month = ad spend billed so far (flat slots bill per day while live; CPM/CPC slots bill per view / click).
        Highest-earning slot this month: <b>{bestSlot(slots)}</b>. Trends by slot are on the <Link className="link" href="/admin/revenue">Revenue</Link> page.
      </p>
    </>
  );
}

function bestSlot(slots: SlotRow[]) {
  const b = [...slots].sort((a, c) => c.mtdRevenue - a.mtdRevenue)[0];
  return b ? `${b.code} ${b.name} (${formatINR(b.mtdRevenue)})` : "—";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthName(key: string) {
  return MONTHS[Number(key.slice(5, 7)) - 1];
}
