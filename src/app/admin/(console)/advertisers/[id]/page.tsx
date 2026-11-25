import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { compactNumber, formatINR } from "@/lib/money";
import { db } from "@/lib/db";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  Card,
  DataTable,
  EmptyState,
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
import { AdvertiserFormButton } from "@/components/admin/growth/advertiser-form";
import { CampaignName, flightLabel, GIcon, SlotLine, StatePill } from "@/components/admin/growth/bits";
import { PaymentPill } from "@/components/admin/growth/campaign-view";
import { ChartTips } from "@/components/admin/growth/chart-tips";
import { Columns, monthLabel } from "@/components/admin/growth/charts";
import { getAdvertiser, type AdvertiserDetail } from "@/server/admin/growth/advertisers";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Advertiser" };
/** Detail pages read the session + URL params at request time; the console shell's URL-derived crumb blocks too. */
export const instant = false;

type Params = { id: string };

export default function AdvertiserPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Advertiser" back={{ href: "/admin/advertisers", label: "Advertisers" }} />
          <SkeletonPage stats={4} rows={8} />
        </>
      }
    >
      <AdvertiserContent params={params} />
    </Suspense>
  );
}

async function AdvertiserContent({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/advertisers/${id}`);
  const [a, brands] = await Promise.all([getAdvertiser(id), db.brand.findMany({ where: { isOwn: false }, orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  if (!a) notFound();

  type Camp = AdvertiserDetail["campaigns"][number];
  type Pay = AdvertiserDetail["payments"][number];
  const campCols: Column<Camp>[] = [
    {
      key: "c",
      label: "Campaign",
      main: true,
      render: (c) => <CampaignName href={`/admin/campaigns/${c.id}`} brand={c.brand} isHouse={false} title={c.headline} sub={c.code} />,
    },
    { key: "s", label: "Slot", render: (c) => <SlotLine code={c.slot.code} name={c.slot.name} href={`/admin/ads/${c.slot.code}`} /> },
    { key: "st", label: "Status", render: (c) => <StatePill tone={c.tone} label={c.stateLabel} /> },
    { key: "d", label: "Flight", render: (c) => <span className="nowrap">{flightLabel(c.startsAt, c.endsAt)}</span> },
    { key: "b", label: "Booked", align: "right", render: (c) => <span className="num">{formatINR(c.booked)}</span> },
    { key: "sp", label: "Spent", align: "right", render: (c) => <b className="num">{formatINR(c.spent)}</b> },
    { key: "r", label: "Results", align: "right", render: (c) => <span className="num nowrap">{compactNumber(c.impressions)} impr.<span className="ag-sub">{c.impressions ? pct(c.clicks / c.impressions, 2) : "—"} CTR</span></span> },
    { key: "p", label: "Payment", render: (c) => <PaymentPill status={c.paymentStatus} /> },
  ];
  const payCols: Column<Pay>[] = [
    { key: "d", label: "Date", main: true, render: (p) => fmtDateTime(p.createdAt) },
    { key: "c", label: "Campaign", render: (p) => <Link className="link" href={`/admin/campaigns/${p.campaignId}`}>{p.campaignCode}</Link> },
    { key: "pr", label: "Method", render: (p) => p.provider },
    { key: "ref", label: "Reference", render: (p) => <span className="ag-mono">{p.providerPaymentId ?? "—"}</span> },
    { key: "a", label: "Amount", align: "right", render: (p) => <b className="num">{formatINR(p.amount)}</b> },
    { key: "s", label: "Status", render: (p) => <StatusPill kind="payment" status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/advertisers", label: "Advertisers" }}
        title={a.companyName}
        badge={a.brand ? <span className="am-tag" style={{ padding: "4px 10px" }}><BrandLogo brand={a.brand} size={12} showSub={false} /></span> : null}
        sub={`${a.contactName} · ${a.email}${a.phone ? ` · ${a.phone}` : ""} · since ${fmtDate(a.createdAt)}`}
        actions={
          <>
            <AdvertiserFormButton
              id={a.id}
              brands={brands}
              className="btn btn-ghost btn-sm"
              initial={{ companyName: a.companyName, contactName: a.contactName, email: a.email, phone: a.phone ?? "", gstin: a.gstin ?? "", brandId: a.brandId ?? "" }}
            />
            <Link className="btn btn-dark btn-sm" href={`/admin/campaigns/new?advertiser=${a.id}`}>
              <GIcon name="plus" />
              New campaign
            </Link>
          </>
        }
      />
      <StatGrid label="Advertiser summary">
        <StatCard label="Lifetime spend" value={formatINR(a.totals.spend)} sub={`of ${formatINR(a.totals.booked)} booked`} />
        <StatCard label="Paid online" value={formatINR(a.totals.paid)} sub={`${a.payments.length} payment${a.payments.length === 1 ? "" : "s"}`} />
        <StatCard label="Campaigns" value={a.campaigns.length} sub={`${a.totals.live} live · ${a.totals.pending} awaiting approval`} />
        <StatCard label="Delivery" value={compactNumber(a.totals.impressions)} unit=" impr." sub={`${compactNumber(a.totals.clicks)} clicks · ${a.totals.impressions ? pct(a.totals.ctr, 2) : "—"} CTR`} />
      </StatGrid>
      <div className="am-grid">
        <div className="am-span8">
          <Card title="Spend by month" sub="Billed ad delivery">
            <Columns
              size="wide"
              points={a.monthly.map((m) => ({ key: m.month, label: monthLabel(m.month).slice(0, 3), full: monthLabel(m.month), v: m.spend, extra: [["Impressions", m.impressions.toLocaleString("en-IN"), ""], ["Clicks", m.clicks.toLocaleString("en-IN"), ""]] }))}
              format="inr"
              series="Spend"
              aria={`${a.companyName} ad spend by month`}
            />
          </Card>
        </div>
        <div className="am-span4">
          <Card title="Profile">
            <KeyValues
              rows={[
                ["Company", a.companyName],
                ["Contact", a.contactName],
                ["Email", <a className="link" key="e" href={`mailto:${a.email}`}>{a.email}</a>],
                ["Mobile", a.phone ?? "—"],
                ["GSTIN", a.gstin ? <span className="ag-mono" key="g">{a.gstin}</span> : "—"],
                ["Brand", a.brand?.name ?? "—"],
                ["Self-serve login", a.user ? `${a.user.email ?? "Yes"}${a.user.lastLoginAt ? ` · last ${fmtDate(a.user.lastLoginAt)}` : ""}` : "No — booked offline / by email"],
              ]}
            />
          </Card>
        </div>
      </div>
      <Card title="Campaigns" sub={`${a.campaigns.length} total`}>
        <DataTable
          rows={a.campaigns}
          columns={campCols}
          rowKey={(c) => c.id}
          className="ag-ctable"
          minWidth={980}
          empty={<EmptyState icon="layers" title="No campaigns yet" action={<Link className="btn btn-dark btn-sm" href={`/admin/campaigns/new?advertiser=${a.id}`}>Create one</Link>} />}
        />
      </Card>
      <Card title="Payments" sub="Online payments for their campaigns (Razorpay / test gateway)">
        <DataTable rows={a.payments} columns={payCols} rowKey={(p) => p.id} small minWidth={700} empty="No online payments — direct deals are invoiced offline (mark them on the campaign)." />
      </Card>
      <ChartTips />
    </>
  );
}
