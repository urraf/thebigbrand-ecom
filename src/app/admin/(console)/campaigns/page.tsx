import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import {
  Card,
  DataTable,
  EmptyState,
  FilterChips,
  flatParams,
  PageHeader,
  Pagination,
  SkeletonPage,
  StatCard,
  StatGrid,
  Toolbar,
  type SearchParamsInput,
} from "@/components/admin/ui";
import { GIcon } from "@/components/admin/growth/bits";
import { ApprovedHint, campaignColumns, QueueCard } from "@/components/admin/growth/campaign-view";
import { campaignListQuery, campaignSummary, editorOptions, getCampaign, listCampaigns } from "@/server/admin/growth/campaigns";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Campaigns" };

const STATE_OPTIONS = [
  { value: "LIVE", label: "Live" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PENDING_REVIEW", label: "Awaiting approval" },
  { value: "PAUSED", label: "Paused" },
  { value: "SLOT_PAUSED", label: "Slot paused" },
  { value: "BUDGET_SPENT", label: "Budget spent" },
  { value: "FINISHED", label: "Finished" },
  { value: "DRAFT", label: "Draft" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ENDED", label: "Ended" },
];

export default function CampaignsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader
        title="Campaigns"
        sub="Brand bookings from the Advertise page and the seller portal, plus your own house promos."
        actions={
          <>
            <Link className="btn btn-ghost btn-sm" href="/admin/campaigns/new?house=1">
              <GIcon name="sparkle" />
              New house campaign
            </Link>
            <Link className="btn btn-dark btn-sm" href="/admin/campaigns/new">
              <GIcon name="plus" />
              New campaign
            </Link>
          </>
        }
      />
      <Suspense fallback={<SkeletonPage stats={4} rows={10} />}>
        <CampaignsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CampaignsContent({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/campaigns");
  const params = flatParams(await searchParams);
  const parsed = campaignListQuery.safeParse(params);
  const query = parsed.success ? parsed.data : campaignListQuery.parse({});
  const now = new Date();
  const [list, summary, opts, approved] = await Promise.all([
    listCampaigns(query, now),
    campaignSummary(now),
    editorOptions(),
    params.approved ? getCampaign(params.approved, now) : null,
  ]);
  const queue = (await Promise.all(summary.pending.slice(0, 10).map((p) => getCampaign(p.id, now)))).filter((c) => c !== null);
  const avg = summary.avgApprovalMs;
  const avgLabel = avg == null ? "—" : avg < 3_600_000 ? `${Math.max(1, Math.round(avg / 60_000))}m` : `${Math.floor(avg / 3_600_000)}h ${Math.round((avg % 3_600_000) / 60_000)}m`;
  const filtered = Boolean(query.q || query.state || query.status || query.slot || query.advertiser || query.house);

  return (
    <>
      <StatGrid label="Campaign summary">
        <StatCard tone={summary.pending.length ? "cta" : undefined} label="Awaiting approval" value={summary.pending.length} sub={`${formatINR(summary.pendingValue)} in bookings`} />
        <StatCard label="Live now" value={summary.liveCount} sub={`${formatINR(summary.liveValue)} booked across live flights`} />
        <StatCard label="Booked this month" value={formatINR(summary.monthBookings)} sub="new paid campaigns created this month" />
        <StatCard label="Average approval time" value={avgLabel} sub={<a className="link" href="/advertise" target="_blank" rel="noopener">See what advertisers see →</a>} />
      </StatGrid>

      {approved && approved.status === "APPROVED" ? <ApprovedHint c={approved} /> : null}

      <section className="am-sec" aria-labelledby="ag-q-h">
        <div className="am-sec-h">
          <h2 id="ag-q-h">Approval queue</h2>
          <span className="am-count">{summary.pending.length}</span>
          <p>Brands and sellers booked these slots. Approve to put the creative live in its slot instantly — or reject with a reason they will see.</p>
        </div>
        {queue.length ? (
          <div className="am-camps">
            {queue.map((c) => (
              <QueueCard key={c.id} c={c} now={now.toISOString()} />
            ))}
            {summary.pending.length > queue.length ? (
              <Link className="link" href="/admin/campaigns?state=PENDING_REVIEW">
                {summary.pending.length - queue.length} more awaiting approval →
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="blk">
            <EmptyState icon="check" ok title="All caught up">
              No campaigns are waiting. New bookings from the Advertise page and the seller portal land here for approval.
            </EmptyState>
          </div>
        )}
      </section>

      <Card title="All campaigns" sub={`${list.total.toLocaleString("en-IN")} ${filtered ? "matching" : "in total"} · newest first`}>
        <FilterChips
          basePath="/admin/campaigns"
          params={params}
          param="state"
          label="Filter by status"
          options={[
            { value: "", label: "All" },
            { value: "LIVE", label: "Live", count: summary.liveCount },
            { value: "PENDING_REVIEW", label: "Awaiting approval", count: summary.pending.length },
            { value: "SCHEDULED", label: "Scheduled" },
            { value: "PAUSED", label: "Paused", count: summary.byStatus.PAUSED ?? 0 },
            { value: "FINISHED", label: "Finished" },
            { value: "REJECTED", label: "Rejected", count: summary.byStatus.REJECTED ?? 0 },
            { value: "DRAFT", label: "Drafts", count: summary.byStatus.DRAFT ?? 0 },
          ]}
        />
        <Toolbar
          search={{ param: "q", placeholder: "Search campaign, code, brand, advertiser…" }}
          filters={[
            { param: "slot", label: "Slot", allLabel: "All slots", options: opts.slots.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` })) },
            { param: "advertiser", label: "Advertiser", allLabel: "All advertisers", options: opts.advertisers.map((a) => ({ value: a.id, label: a.name })) },
            { param: "house", label: "Type", allLabel: "Paid & house", options: [{ value: "0", label: "Paid only" }, { value: "1", label: "House only" }] },
            { param: "state", label: "Status", allLabel: "Any status", options: STATE_OPTIONS },
          ]}
        />
        <DataTable
          rows={list.items}
          columns={campaignColumns()}
          rowKey={(c) => c.id}
          basePath="/admin/campaigns"
          params={params}
          className="ag-ctable"
          minWidth={1000}
          empty={
            <EmptyState icon="layers" title={filtered ? "No campaigns match these filters" : "No campaigns yet"}>
              {filtered ? "Try clearing a filter." : "Create a house campaign to promote your own offers."}
            </EmptyState>
          }
        />
        <Pagination basePath="/admin/campaigns" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="campaigns" />
      </Card>
    </>
  );
}
