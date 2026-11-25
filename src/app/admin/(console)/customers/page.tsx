import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { customerStats, CustomerListQuery, listCustomers } from "@/server/admin/core/customers";
import { CustomerCell } from "@/components/admin/core/bits";
import { Card, DataTable, EmptyState, Pill, PageHeader, Pagination, SkeletonPage, StatCard, StatGrid, Toolbar, fmtAgo, fmtDate, flatParams, pct, type SearchParamsInput } from "@/components/admin/ui";

export const metadata = { title: "Customers" };

async function Customers({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/customers");
  const params = flatParams(await searchParams);
  const parsed = CustomerListQuery.safeParse(params);
  const q = parsed.success ? parsed.data : CustomerListQuery.parse({});
  const [list, s] = await Promise.all([listCustomers(q), customerStats()]);
  const now = new Date().toISOString();
  return (
    <>
      <StatGrid label="Customer summary">
        <StatCard label="Customers" value={s.total.toLocaleString("en-IN")} sub={`${s.newMonth} joined in the last 30 days`} />
        <StatCard label="Have ordered" value={s.buyers.toLocaleString("en-IN")} sub={`${pct(s.total ? s.buyers / s.total : 0)} of sign-ups`} href="/admin/customers?segment=buyers" />
        <StatCard label="Repeat buyers" value={s.repeat.toLocaleString("en-IN")} sub={`${pct(s.buyers ? s.repeat / s.buyers : 0)} of buyers came back`} href="/admin/customers?segment=repeat" />
        <StatCard label="Disabled accounts" value={s.disabled} sub="Can't sign in or order" href="/admin/customers?status=disabled" tone={s.disabled ? "warn" : undefined} />
      </StatGrid>
      <Card title="All customers" sub="Shoppers who signed up with their mobile number or email." id="am-customers">
        <Toolbar
          search={{ placeholder: "Name, email or mobile…" }}
          filters={[
            { param: "segment", label: "Segment", allLabel: "Everyone", options: [{ value: "buyers", label: "Have ordered" }, { value: "repeat", label: "Repeat buyers" }, { value: "none", label: "No orders yet" }] },
            { param: "status", label: "Account", allLabel: "Any account status", options: [{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }] },
          ]}
        />
        <DataTable
          basePath="/admin/customers"
          params={params}
          sort={{ by: q.sort, dir: q.dir }}
          rows={list.items}
          rowKey={(c) => c.id}
          rowClassName={(c) => (c.isActive ? undefined : "is-off")}
          minWidth={860}
          empty={<EmptyState icon="users" title="No customers match">Try a different search or clear the filters.</EmptyState>}
          columns={[
            {
              key: "name",
              label: "Customer",
              sortable: "name",
              main: true,
              render: (c) => (
                <Link href={`/admin/customers/${c.id}`} className="am-custlink">
                  <CustomerCell name={c.name || c.email || c.phone || "Customer"} sub={[c.phone ? `+91 ${c.phone}` : null, c.email].filter(Boolean).join(" · ")} />
                </Link>
              ),
            },
            { key: "orders", label: "Orders", align: "right", sortable: "orders", render: (c) => <b className="num">{c.orders}</b> },
            { key: "spent", label: "Total spent", align: "right", sortable: "spent", render: (c) => <span className="num">{formatINR(c.spent)}</span> },
            { key: "last", label: "Last order", sortable: "last", render: (c) => (c.lastOrderAt ? <span title={fmtDate(c.lastOrderAt)}>{fmtAgo(c.lastOrderAt, now)}</span> : <span className="am-muted">Never</span>) },
            { key: "joined", label: "Joined", sortable: "recent", hideMobile: true, render: (c) => <span className="nowrap">{fmtDate(c.createdAt)}</span> },
            { key: "st", label: "Account", className: "am-keep", render: (c) => (c.isActive ? <Pill tone="live">Active</Pill> : <Pill tone="rejected">Disabled</Pill>) },
            {
              key: "act",
              label: "",
              align: "right",
              actions: true,
              className: "am-keep",
              render: (c) => (
                <Link className="btn btn-ghost btn-sm" href={`/admin/customers/${c.id}`}>
                  View
                </Link>
              ),
            },
          ]}
        />
        <Pagination basePath="/admin/customers" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="customers" />
      </Card>
    </>
  );
}

export default function CustomersPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader title="Customers" sub="Who's buying, how often, and account access." />
      <Suspense fallback={<SkeletonPage />}>
        <Customers searchParams={searchParams} />
      </Suspense>
    </>
  );
}
