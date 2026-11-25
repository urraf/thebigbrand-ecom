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
  fmtAgo,
  PageHeader,
  Pagination,
  SkeletonPage,
  StatCard,
  StatGrid,
  StatusPill,
  Toolbar,
  type Column,
  type SearchParamsInput,
} from "@/components/admin/ui";
import { SellerActions } from "@/components/admin/growth/seller-controls";
import { appliedLabel, KycChecks, KycGrid, SellerAvatar } from "@/components/admin/growth/seller-view";
import { listSellers, sellerListQuery, type SellerListItem } from "@/server/admin/growth/sellers";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Sellers" };

export default function SellersPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader
        title="Sellers"
        sub="Third-party sellers on the marketplace — review applications, set commission and control access."
        actions={
          <a className="btn btn-ghost btn-sm" href="/sell" target="_blank" rel="noopener">
            “Sell on TBB” page
          </a>
        }
      />
      <Suspense fallback={<SkeletonPage stats={4} rows={8} />}>
        <SellersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SellersContent({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/sellers");
  const params = flatParams(await searchParams);
  const parsed = sellerListQuery.safeParse(params);
  const query = parsed.success ? parsed.data : sellerListQuery.parse({});
  const now = new Date();
  const [list, pending, all] = await Promise.all([
    listSellers(query, now),
    listSellers({ status: "PENDING", page: 1, limit: 20 }, now),
    listSellers({ page: 1, limit: 100 }, now),
  ]);
  const gmv = all.items.reduce((t, s) => t + s.gmv30, 0);
  const owed = all.items.reduce((t, s) => t + Math.max(0, s.balance), 0);
  const showQueue = pending.items.length > 0 && (!query.status || query.status === "PENDING") && !query.q;

  const cols: Column<SellerListItem>[] = [
    {
      key: "n",
      label: "Seller",
      main: true,
      render: (s) => (
        <Link className="am-cust" href={`/admin/sellers/${s.id}`}>
          <SellerAvatar name={s.displayName} size={34} />
          <span>
            <b>{s.displayName}</b>
            <small>
              {s.businessName} · {s.city ?? "—"}
            </small>
          </span>
        </Link>
      ),
    },
    { key: "st", label: "Status", render: (s) => <StatusPill kind="seller" status={s.status} /> },
    { key: "c", label: "Commission", align: "right", render: (s) => <span className="num">{s.commissionPct}%</span> },
    {
      key: "p",
      label: "Products",
      align: "right",
      render: (s) => (
        <span className="num">
          {s.liveProducts} live
          <span className="ag-sub">{s.pendingProducts ? `${s.pendingProducts} awaiting approval` : `${s.products} total`}</span>
        </span>
      ),
    },
    { key: "g", label: "GMV · 30 days", align: "right", render: (s) => <b className="num">{formatINR(s.gmv30)}</b> },
    {
      key: "b",
      label: "Balance",
      align: "right",
      render: (s) => (
        <span className={s.balance < 0 ? "ag-bal neg" : "ag-bal"}>
          {formatINR(s.balance)}
          {s.openPayouts ? <span className="ag-sub">{formatINR(s.openPayouts)} in payouts</span> : null}
        </span>
      ),
    },
    { key: "l", label: "Last sign-in", hideMobile: true, render: (s) => <span className="nowrap am-muted">{s.lastLoginAt ? fmtAgo(s.lastLoginAt, now) : "Never"}</span> },
    { key: "a", label: "", actions: true, render: (s) => <SellerActions id={s.id} name={s.displayName} status={s.status} /> },
  ];

  return (
    <>
      <StatGrid label="Seller summary">
        <StatCard label="Approved sellers" value={all.counts.APPROVED} sub={`${all.counts.SUSPENDED} suspended · ${all.counts.REJECTED} rejected`} />
        <StatCard tone={all.counts.PENDING ? "cta" : undefined} label="Applications to review" value={all.counts.PENDING} sub={all.counts.PENDING ? "KYC + bank details below" : "All caught up"} />
        <StatCard label="Seller GMV · 30 days" value={formatINR(gmv)} sub={`${all.items.reduce((t, s) => t + s.units30, 0)} units sold`} />
        <StatCard label="Owed to sellers" value={formatINR(owed)} sub={<Link className="link" href="/admin/payouts">Payouts &amp; ledger →</Link>} />
      </StatGrid>

      {showQueue ? (
        <section className="am-sec" aria-labelledby="ag-apps-h">
          <div className="am-sec-h">
            <h2 id="ag-apps-h">Applications</h2>
            <span className="am-count">{pending.items.length}</span>
            <p>Check the GSTIN, PAN and bank details, then approve to unlock the seller portal. Their products still need approval one by one.</p>
          </div>
          <div className="ag-apps">
            {pending.items.map((s) => (
              <article key={s.id} className="blk ag-app">
                <div className="ag-app-h">
                  <SellerAvatar name={s.displayName} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3>
                      <Link href={`/admin/sellers/${s.id}`}>{s.displayName}</Link>
                    </h3>
                    <p>
                      {s.businessName} · {appliedLabel(s.createdAt)} ({fmtAgo(s.createdAt, now)}) · {s.city ?? "—"}
                    </p>
                  </div>
                  <StatusPill kind="seller" status={s.status} />
                </div>
                <KycGrid s={s} />
                <div className="ag-row" style={{ justifyContent: "space-between" }}>
                  <KycChecks s={s} />
                  <SellerActions id={s.id} name={s.displayName} status={s.status} size="md" />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Card title="All sellers" sub={`${list.total} ${query.status || query.q ? "matching" : "in total"}`}>
        <FilterChips
          basePath="/admin/sellers"
          params={params}
          param="status"
          label="Filter by status"
          options={[
            { value: "", label: "All", count: all.total },
            { value: "PENDING", label: "Pending", count: all.counts.PENDING },
            { value: "APPROVED", label: "Approved", count: all.counts.APPROVED },
            { value: "SUSPENDED", label: "Suspended", count: all.counts.SUSPENDED },
            { value: "REJECTED", label: "Rejected", count: all.counts.REJECTED },
          ]}
        />
        <Toolbar search={{ param: "q", placeholder: "Search seller, business, GSTIN, city…" }} />
        <DataTable
          rows={list.items}
          columns={cols}
          rowKey={(s) => s.id}
          minWidth={1040}
          empty={<EmptyState icon="store" title="No sellers here">Sellers apply from the “Sell on TBB” page.</EmptyState>}
        />
        <Pagination basePath="/admin/sellers" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="sellers" />
      </Card>
    </>
  );
}
