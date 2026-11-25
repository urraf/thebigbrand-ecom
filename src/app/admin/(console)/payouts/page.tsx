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
  fmtDate,
  fmtDateTime,
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
import { GIcon } from "@/components/admin/growth/bits";
import { AdjustmentButton, CreatePayoutButton, PayoutStatusActions } from "@/components/admin/growth/payout-controls";
import { getPayoutsOverview, LEDGER_LABEL, LEDGER_TYPES, ledgerQuery, listLedger, PAYOUT_STATUSES, type PayoutsOverview } from "@/server/admin/growth/payouts";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Payouts & ledger" };

export default function PayoutsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Payouts & ledger" sub="What the marketplace owes each seller and the money sent to them" />
          <SkeletonPage stats={4} rows={10} />
        </>
      }
    >
      <PayoutsContent searchParams={searchParams} />
    </Suspense>
  );
}

type Bal = PayoutsOverview["balances"][number];
type Pay = PayoutsOverview["payouts"][number];

async function PayoutsContent({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const auth = await requireAdminPage("/admin/payouts");
  const isSuper = auth.user.role === "ADMIN";
  const params = flatParams(await searchParams);
  const pstatus = (PAYOUT_STATUSES as readonly string[]).includes(params.pstatus ?? "") ? (params.pstatus as (typeof PAYOUT_STATUSES)[number]) : undefined;
  const lq = ledgerQuery.safeParse({ sellerId: params.seller, type: params.type, from: params.from, to: params.to, page: params.page, limit: 25 });
  const lquery = lq.success ? lq.data : ledgerQuery.parse({ limit: 25 });
  const [ov, ledger, allPayouts] = await Promise.all([getPayoutsOverview({ status: pstatus }), listLedger(lquery), pstatus ? getPayoutsOverview({}) : null]);
  const counts = (allPayouts ?? ov).payouts.reduce<Record<string, number>>((m, p) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
  const sellers = ov.balances.map((b) => ({ id: b.sellerId, name: b.name }));
  const csv = new URLSearchParams({ format: "csv", ...(lquery.sellerId ? { sellerId: lquery.sellerId } : {}), ...(lquery.type ? { type: lquery.type } : {}), ...(lquery.from ? { from: lquery.from } : {}), ...(lquery.to ? { to: lquery.to } : {}) });

  const balCols: Column<Bal>[] = [
    {
      key: "s",
      label: "Seller",
      main: true,
      render: (b) => (
        <Link className="ag-link" href={`/admin/sellers/${b.sellerId}?tab=ledger`} style={{ color: "inherit" }}>
          <b>{b.name}</b>
          <span className="ag-bank">
            {b.bank.account ? `${b.bank.account} · ${b.bank.ifsc ?? ""}` : b.bank.upi ?? "No payout details"}
            {b.status !== "APPROVED" ? ` · ${b.status.toLowerCase()}` : ""}
          </span>
        </Link>
      ),
    },
    { key: "sa", label: "Sales", align: "right", render: (b) => <span className="num">{formatINR(b.sales)}</span> },
    { key: "c", label: "Commission", align: "right", render: (b) => (b.commission ? <span className="num ag-neg">−{formatINR(b.commission)}</span> : <span className="num">—</span>) },
    { key: "r", label: "Returns", align: "right", hideMobile: true, render: (b) => <span className="num">{b.refunds ? `−${formatINR(b.refunds)}` : "—"}</span> },
    { key: "ad", label: "Ad spend", align: "right", hideMobile: true, render: (b) => <span className="num">{b.adSpend ? `−${formatINR(b.adSpend)}` : "—"}</span> },
    { key: "aj", label: "Adjustments", align: "right", hideMobile: true, render: (b) => <span className="num">{b.adjustments ? `${b.adjustments > 0 ? "+" : "−"}${formatINR(Math.abs(b.adjustments))}` : "—"}</span> },
    { key: "p", label: "Paid out", align: "right", render: (b) => <span className="num">{formatINR(b.paidOut)}</span> },
    {
      key: "b",
      label: "Balance",
      align: "right",
      render: (b) => (
        <span className={b.balance < 0 ? "ag-bal neg" : "ag-bal"}>
          {formatINR(b.balance)}
          <span className="ag-sub">{b.reserved ? `${formatINR(b.available)} available` : b.lastPaidAt ? `last paid ${fmtDate(b.lastPaidAt)}` : "never paid"}</span>
        </span>
      ),
    },
    {
      key: "x",
      label: "",
      actions: true,
      render: (b) => (
        <CreatePayoutButton
          seller={{ id: b.sellerId, name: b.name, available: b.available, balance: b.balance, reserved: b.reserved, bank: b.bank.account ? `${b.bank.name ?? b.name} · ${b.bank.account} · ${b.bank.ifsc ?? ""}` : b.bank.upi, hasBank: b.hasBank }}
          canEdit={isSuper}
          className="btn btn-ghost btn-sm"
        />
      ),
    },
  ];

  const payCols: Column<Pay>[] = [
    {
      key: "s",
      label: "Payout",
      main: true,
      render: (p) => (
        <span>
          <Link className="ag-link" href={`/admin/sellers/${p.sellerId}?tab=ledger`} style={{ color: "inherit" }}>
            <b>{p.sellerName}</b>
          </Link>
          <span className="ag-sub">
            {fmtDateTime(p.createdAt)}
            {p.note ? ` · ${p.note}` : ""}
          </span>
        </span>
      ),
    },
    { key: "a", label: "Amount", align: "right", render: (p) => <b className="num">{formatINR(p.amount)}</b> },
    { key: "st", label: "Status", render: (p) => <StatusPill kind="payout" status={p.status} /> },
    { key: "b", label: "To", render: (p) => <span className="ag-bank">{p.bank ?? "—"}{p.ifsc ? ` · ${p.ifsc}` : ""}</span> },
    { key: "per", label: "Period", hideMobile: true, render: (p) => (p.periodStart ? <span className="nowrap">{fmtDate(p.periodStart)} – {p.periodEnd ? fmtDate(p.periodEnd) : "…"}</span> : "—") },
    { key: "r", label: "UTR", render: (p) => <span className="ag-mono">{p.reference ?? "—"}</span> },
    { key: "pd", label: "Paid", render: (p) => (p.paidAt ? <span className="nowrap">{fmtDate(p.paidAt)}</span> : "—") },
    { key: "x", label: "", actions: true, render: (p) => <PayoutStatusActions payout={{ id: p.id, status: p.status, amount: p.amount, sellerName: p.sellerName }} canEdit={isSuper} /> },
  ];

  type Row = (typeof ledger.items)[number];
  const ledCols: Column<Row>[] = [
    { key: "d", label: "Date", main: true, render: (e) => <span className="nowrap">{fmtDateTime(e.createdAt)}</span> },
    { key: "s", label: "Seller", render: (e) => <Link className="ag-link" href={`/admin/sellers/${e.sellerId}?tab=ledger`} style={{ color: "inherit" }}>{e.sellerName}</Link> },
    { key: "t", label: "Type", render: (e) => <span className="am-tag">{e.typeLabel}</span> },
    {
      key: "n",
      label: "Details",
      render: (e) => (
        <span>
          {e.note ?? "—"}
          {e.orderNumber ? (
            <span className="ag-sub">
              <Link className="link" href={`/admin/orders/${e.orderNumber}`}>{e.orderNumber}</Link>
              {e.item ? ` · ${e.item}` : ""}
            </span>
          ) : e.reference && !(e.note ?? "").includes(e.reference) ? (
            <span className="ag-sub">UTR {e.reference}</span>
          ) : null}
        </span>
      ),
    },
    { key: "a", label: "Amount", align: "right", render: (e) => <b className={e.amount < 0 ? "num ag-neg" : "num ag-pos"}>{e.amount > 0 ? "+" : "−"}{formatINR(Math.abs(e.amount))}</b> },
  ];

  return (
    <>
      <PageHeader
        title="Payouts & ledger"
        sub="What the marketplace owes each seller (sales − commission − returns − ad spend ± adjustments) and the money sent to them."
        actions={
          <>
            <a className="btn btn-ghost btn-sm" href="/api/v1/admin/payouts/ledger?format=csv" download>
              <GIcon name="download" />
              Full ledger CSV
            </a>
            <AdjustmentButton sellers={sellers} canEdit={isSuper} />
          </>
        }
      />
      {!isSuper ? (
        <div className="ag-note">
          <GIcon name="shield" />
          <div>You can view balances and the ledger. Creating payouts, marking them paid and manual adjustments need an <b>admin (owner)</b> account.</div>
        </div>
      ) : null}
      <StatGrid label="Payout summary">
        <StatCard label="Owed to sellers" value={formatINR(ov.summary.owed)} sub={`${formatINR(ov.summary.available)} available to pay now`} />
        <StatCard tone={ov.summary.openCount ? "cta" : undefined} label="Open payouts" value={formatINR(ov.summary.reserved)} sub={`${ov.summary.openCount} pending / processing`} />
        <StatCard label="Paid this month" value={formatINR(ov.summary.paidThisMonth)} sub={`${ov.summary.paidThisMonthCount} payout${ov.summary.paidThisMonthCount === 1 ? "" : "s"}`} />
        <StatCard label="Commission earned" value={formatINR(ov.summary.commissionEarned)} sub="lifetime, on delivered items" />
      </StatGrid>

      <Card title="Seller balances" sub="Available = ledger balance − payouts already pending or processing">
        <ol className="ag-flow" aria-label="Payout flow" style={{ marginBottom: 12 }}>
          <li>“Pay out” creates a pending payout</li>
          <li>
            <GIcon name="chevRight" />
            mark it processing when the bank transfer starts
          </li>
          <li>
            <GIcon name="chevRight" />
            mark it paid with the bank UTR — the seller ledger is debited
          </li>
        </ol>
        <DataTable rows={ov.balances} columns={balCols} rowKey={(b) => b.sellerId} minWidth={1040} empty={<EmptyState icon="store" title="No approved sellers yet" />} />
      </Card>

      <Card title="Payouts" sub="Latest 200">
        <FilterChips
          basePath="/admin/payouts"
          params={params}
          param="pstatus"
          label="Filter payouts by status"
          options={[{ value: "", label: "All", count: Object.values(counts).reduce((t, n) => t + n, 0) }, ...PAYOUT_STATUSES.map((s) => ({ value: s, label: s[0] + s.slice(1).toLowerCase(), count: counts[s] ?? 0 }))]}
        />
        <DataTable rows={ov.payouts} columns={payCols} rowKey={(p) => p.id} minWidth={1000} empty={<EmptyState icon="card" title="No payouts here yet" />} />
      </Card>

      <Card
        id="ledger"
        title="Ledger"
        sub={`${ledger.total.toLocaleString("en-IN")} entries · net ${ledger.net < 0 ? "−" : ""}${formatINR(Math.abs(ledger.net))} for these filters`}
        actions={
          <a className="btn btn-ghost btn-sm" href={`/api/v1/admin/payouts/ledger?${csv}`} download>
            <GIcon name="download" />
            Export CSV
          </a>
        }
      >
        <Toolbar
          filters={[
            { param: "seller", label: "Seller", allLabel: "All sellers", options: sellers.map((s) => ({ value: s.id, label: s.name })) },
            { param: "type", label: "Type", allLabel: "All types", options: LEDGER_TYPES.map((t) => ({ value: t, label: LEDGER_LABEL[t] })) },
          ]}
          dateRange={{ from: "from", to: "to" }}
        />
        <DataTable rows={ledger.items} columns={ledCols} rowKey={(e) => e.id} small minWidth={820} empty={<EmptyState icon="card" title="No ledger entries match" />} />
        <Pagination basePath="/admin/payouts" params={params} page={ledger.page} pages={ledger.pages} total={ledger.total} limit={ledger.limit} noun="entries" />
      </Card>
    </>
  );
}
