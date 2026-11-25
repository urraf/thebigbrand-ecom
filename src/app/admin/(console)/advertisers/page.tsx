import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { compactNumber, formatINR } from "@/lib/money";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  Card,
  DataTable,
  EmptyState,
  flatParams,
  fmtDate,
  PageHeader,
  Pagination,
  pct,
  SkeletonPage,
  StatCard,
  StatGrid,
  Toolbar,
  type Column,
  type SearchParamsInput,
} from "@/components/admin/ui";
import { AdvertiserFormButton } from "@/components/admin/growth/advertiser-form";
import { advertiserListQuery, listAdvertisers } from "@/server/admin/growth/advertisers";
import { db } from "@/lib/db";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Advertisers" };

type Row = Awaited<ReturnType<typeof listAdvertisers>>["items"][number];

export default function AdvertisersPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Advertisers" sub="Brands and agencies buying ad space" />
          <SkeletonPage stats={4} rows={10} />
        </>
      }
    >
      <AdvertisersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdvertisersContent({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/advertisers");
  const params = flatParams(await searchParams);
  const q = advertiserListQuery.safeParse(params);
  const query = q.success ? q.data : advertiserListQuery.parse({});
  const [list, brands, all] = await Promise.all([
    listAdvertisers(query),
    db.brand.findMany({ where: { isOwn: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listAdvertisers({ page: 1, limit: 100 }),
  ]);
  const totalSpend = all.items.reduce((t, a) => t + a.spend, 0);
  const live = all.items.filter((a) => a.live > 0).length;
  const pending = all.items.reduce((t, a) => t + a.pending, 0);
  const top = [...all.items].sort((a, b) => b.spend - a.spend)[0];

  const cols: Column<Row>[] = [
    {
      key: "n",
      label: "Advertiser",
      main: true,
      render: (a) => (
        <Link className="am-cname" href={`/admin/advertisers/${a.id}`}>
          <span className="am-cname-l">{a.brand ? <BrandLogo brand={a.brand} size={13} showSub={false} /> : <b>{a.companyName.slice(0, 2).toUpperCase()}</b>}</span>
          <span>
            <b>{a.companyName}</b>
            <small>
              {a.contactName} · {a.email}
            </small>
          </span>
        </Link>
      ),
    },
    {
      key: "c",
      label: "Campaigns",
      render: (a) => (
        <span>
          <b className="num">{a.campaigns}</b>
          <span className="ag-sub">
            {a.live} live{a.pending ? ` · ${a.pending} awaiting approval` : ""}
          </span>
        </span>
      ),
    },
    { key: "s", label: "Lifetime spend", align: "right", render: (a) => <b className="num">{formatINR(a.spend)}</b> },
    { key: "p", label: "Paid online", align: "right", render: (a) => <span className="num">{a.paid ? formatINR(a.paid) : "—"}</span> },
    {
      key: "r",
      label: "Delivery",
      align: "right",
      render: (a) => (
        <span className="num nowrap">
          {compactNumber(a.impressions)} impr.
          <span className="ag-sub">{a.impressions ? pct(a.ctr, 2) : "—"} CTR</span>
        </span>
      ),
    },
    { key: "d", label: "Since", hideMobile: true, render: (a) => <span className="nowrap">{fmtDate(a.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Advertisers"
        sub="Brands and agencies buying ad space — self-serve bookings from the Advertise page and your direct deals."
        actions={<AdvertiserFormButton brands={brands} autoOpen={params.new === "1"} />}
      />
      <StatGrid label="Advertiser summary">
        <StatCard label="Advertisers" value={all.total} sub={`${live} with a live campaign`} />
        <StatCard label="Lifetime ad spend" value={formatINR(totalSpend)} sub="billed delivery across all campaigns" />
        <StatCard label="Top spender" value={top ? top.companyName.replace(/ India$/, "") : "—"} sub={top ? formatINR(top.spend) : undefined} />
        <StatCard tone={pending ? "cta" : undefined} label="Awaiting approval" value={pending} sub={pending ? <Link className="link" href="/admin/campaigns?state=PENDING_REVIEW">Review bookings →</Link> : "All caught up"} />
      </StatGrid>
      <Card title="All advertisers" sub={`${list.total} ${query.q ? "matching" : "in total"}`}>
        <Toolbar search={{ param: "q", placeholder: "Search company, contact, email, brand…" }} />
        <DataTable
          rows={list.items}
          columns={cols}
          rowKey={(a) => a.id}
          minWidth={860}
          empty={<EmptyState icon="users" title={query.q ? "No advertisers match" : "No advertisers yet"}>Brands that book on the Advertise page appear here automatically.</EmptyState>}
        />
        <Pagination basePath="/admin/advertisers" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="advertisers" />
      </Card>
    </>
  );
}
