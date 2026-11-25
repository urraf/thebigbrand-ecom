import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import {
  Card,
  DataTable,
  EmptyState,
  flatParams,
  fmtDate,
  fmtDateTime,
  KeyValues,
  LinkTabs,
  PageHeader,
  pct,
  SkeletonPage,
  StatCard,
  StatGrid,
  StatusPill,
  type Column,
  type SearchParamsInput,
} from "@/components/admin/ui";
import { GIcon } from "@/components/admin/growth/bits";
import { AdjustmentButton, CreatePayoutButton, PayoutStatusActions } from "@/components/admin/growth/payout-controls";
import { CommissionEditor, SellerActions } from "@/components/admin/growth/seller-controls";
import { KycChecks, KycGrid, SellerAvatar } from "@/components/admin/growth/seller-view";
import { getSeller, type SellerDetail } from "@/server/admin/growth/sellers";
import { LEDGER_LABEL, maskAccount } from "@/server/admin/growth/payouts";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Seller" };
/** Detail pages read the session + URL params at request time; the console shell's URL-derived crumb blocks too. */
export const instant = false;

type Params = { id: string };
const TABS = ["overview", "products", "orders", "ledger"] as const;

export default function SellerPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParamsInput> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Seller" back={{ href: "/admin/sellers", label: "Sellers" }} />
          <SkeletonPage stats={4} rows={8} />
        </>
      }
    >
      <SellerContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Product = SellerDetail["products"][number];
type Item = SellerDetail["items"][number];
type Entry = SellerDetail["ledger"][number];
type Payout = SellerDetail["payouts"][number];

async function SellerContent({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParamsInput> }) {
  const { id } = await params;
  const auth = await requireAdminPage(`/admin/sellers/${id}`);
  const sp = flatParams(await searchParams);
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "overview";
  const d = await getSeller(id);
  if (!d) notFound();
  const { seller: s, performance: perf, money } = d;
  const isSuper = auth.user.role === "ADMIN";
  const base = `/admin/sellers/${s.id}`;
  const payoutSeller = {
    id: s.id,
    name: s.displayName,
    available: money.available,
    balance: money.balance,
    reserved: money.openPayouts,
    bank: maskAccount(s.bankAccountNumber) ? `${s.bankAccountName ?? s.businessName} · ${maskAccount(s.bankAccountNumber)} · ${s.bankIfsc ?? ""}` : s.upiId,
    hasBank: Boolean((s.bankAccountNumber && s.bankIfsc) || s.upiId),
  };

  let body: ReactNode;
  if (tab === "products") {
    const cols: Column<Product>[] = [
      {
        key: "n",
        label: "Product",
        main: true,
        render: (p) => (
          <Link href={`/admin/products/${p.id}`} className="ag-link" style={{ color: "inherit" }}>
            <b>{p.name}</b>
            <span className="ag-sub">
              {p.brandName} · {p.categoryName}
              {p.size ? ` · ${p.size}` : ""}
            </span>
          </Link>
        ),
      },
      {
        key: "s",
        label: "Status",
        render: (p) => (
          <span style={{ display: "grid", gap: 3, justifyItems: "start" }}>
            <StatusPill kind="product" status={p.status} />
            {p.status === "REJECTED" && p.rejectionReason ? <small className="am-muted">{p.rejectionReason}</small> : null}
          </span>
        ),
      },
      { key: "p", label: "Price", align: "right", render: (p) => <span className="num">{formatINR(p.price)}<span className="ag-sub">MRP {formatINR(p.mrp)}</span></span> },
      { key: "st", label: "Stock", align: "right", render: (p) => <span className={p.stock <= 5 ? "num am-crit-t" : "num"}>{p.stock}</span> },
      { key: "so", label: "Sold", align: "right", render: (p) => <span className="num">{p.soldCount}</span> },
    ];
    body = (
      <Card
        title="Products"
        sub={`${d.products.length} listed · new products need approval`}
        actions={d.products.some((p) => p.status === "PENDING") ? <Link className="link" href="/admin/approvals">Product approvals</Link> : undefined}
      >
        <DataTable rows={d.products} columns={cols} rowKey={(p) => p.id} minWidth={760} empty={<EmptyState icon="bag" title="No products yet">They add products from the seller portal.</EmptyState>} />
      </Card>
    );
  } else if (tab === "orders") {
    const cols: Column<Item>[] = [
      {
        key: "o",
        label: "Order",
        main: true,
        render: (i) => (
          <Link href={`/admin/orders/${i.order.number}`} className="ag-link" style={{ color: "inherit" }}>
            <b className="am-oid">{i.order.number}</b>
            <span className="ag-sub">
              {fmtDateTime(i.order.placedAt ?? i.order.createdAt)} · {i.order.shipCity}
            </span>
          </Link>
        ),
      },
      { key: "i", label: "Item", render: (i) => <span>{i.name} × {i.qty}<span className="ag-sub">{i.brandName}</span></span> },
      { key: "s", label: "Status", render: (i) => <span style={{ display: "grid", gap: 3, justifyItems: "start" }}><StatusPill kind="item" status={i.status} />{i.trackingNumber ? <small className="am-muted">{i.courier} · {i.trackingNumber}</small> : null}</span> },
      { key: "t", label: "Item total", align: "right", render: (i) => <b className="num">{formatINR(i.lineTotal)}</b> },
      { key: "c", label: "Commission", align: "right", render: (i) => <span className="num">{formatINR(i.commissionAmt)}<span className="ag-sub">{i.commissionPct}%</span></span> },
      { key: "e", label: "Seller earns", align: "right", render: (i) => <span className="num">{formatINR(i.sellerEarning)}</span> },
    ];
    body = (
      <Card title="Orders" sub={`Their items on customer orders · ${perf.openItems} to dispatch`}>
        <DataTable rows={d.items} columns={cols} rowKey={(i) => i.id} minWidth={900} empty={<EmptyState icon="box" title="No orders yet" />} />
      </Card>
    );
  } else if (tab === "ledger") {
    const lcols: Column<Entry>[] = [
      { key: "d", label: "Date", main: true, render: (e) => <span className="nowrap">{fmtDateTime(e.createdAt)}</span> },
      { key: "t", label: "Type", render: (e) => <span className="am-tag">{LEDGER_LABEL[e.type]}</span> },
      { key: "n", label: "Details", render: (e) => <span>{e.note ?? "—"}{e.orderNumber ? <span className="ag-sub"><Link className="link" href={`/admin/orders/${e.orderNumber}`}>{e.orderNumber}</Link></span> : null}</span> },
      { key: "a", label: "Amount", align: "right", render: (e) => <b className={e.amount < 0 ? "num ag-neg" : "num ag-pos"}>{e.amount > 0 ? "+" : "−"}{formatINR(Math.abs(e.amount))}</b> },
    ];
    const pcols: Column<Payout>[] = [
      { key: "d", label: "Created", main: true, render: (p) => <span className="nowrap">{fmtDateTime(p.createdAt)}<span className="ag-sub">{p.note ?? ""}</span></span> },
      { key: "a", label: "Amount", align: "right", render: (p) => <b className="num">{formatINR(p.amount)}</b> },
      { key: "s", label: "Status", render: (p) => <StatusPill kind="payout" status={p.status} /> },
      { key: "r", label: "UTR", render: (p) => <span className="ag-mono">{p.reference ?? "—"}</span> },
      { key: "pd", label: "Paid", render: (p) => (p.paidAt ? fmtDate(p.paidAt) : "—") },
      { key: "x", label: "", actions: true, render: (p) => <PayoutStatusActions payout={{ id: p.id, status: p.status, amount: p.amount, sellerName: s.displayName }} canEdit={isSuper} /> },
    ];
    body = (
      <>
        <Card
          title="Payouts"
          sub={`${formatINR(money.paidOut)} paid out in total`}
          actions={
            <>
              <AdjustmentButton sellers={[{ id: s.id, name: s.displayName }]} sellerId={s.id} canEdit={isSuper} />
              <CreatePayoutButton seller={payoutSeller} canEdit={isSuper} />
            </>
          }
        >
          <DataTable rows={d.payouts} columns={pcols} rowKey={(p) => p.id} small minWidth={760} empty="No payouts yet." />
        </Card>
        <Card
          title="Ledger"
          sub={`Balance ${formatINR(money.balance)} · latest ${d.ledger.length} entries`}
          actions={
            <a className="btn btn-ghost btn-sm" href={`/api/v1/admin/payouts/ledger?sellerId=${s.id}&format=csv`} download>
              <GIcon name="download" />
              CSV
            </a>
          }
        >
          <DataTable rows={d.ledger} columns={lcols} rowKey={(e) => e.id} small minWidth={640} empty="No ledger entries yet — sales are credited when items are delivered." />
        </Card>
      </>
    );
  } else {
    body = (
      <div className="am-grid">
        <div className="am-span12">
          <Card title="KYC & bank details" sub={`Applied ${fmtDate(s.createdAt)}${s.approvedAt ? ` · approved ${fmtDate(s.approvedAt)}` : ""}`}>
            <div style={{ display: "grid", gap: 14 }}>
              <KycGrid s={s} />
              <KycChecks s={s} />
            </div>
          </Card>
        </div>
        <div className="am-span8 ag-stack">
          <Card title="Performance" sub="All-time unless noted">
            <div className="ag-perf">
              <div>
                <small>GMV · 30 days</small>
                <b>{formatINR(perf.gmv30)}</b>
                <span>{perf.units30} units · {perf.orders30} orders</span>
              </div>
              <div>
                <small>Lifetime GMV</small>
                <b>{formatINR(perf.gmvAll)}</b>
                <span>{formatINR(perf.commissionAll)} commission</span>
              </div>
              <div>
                <small>Avg. time to dispatch</small>
                <b>{perf.avgDispatchH == null ? "—" : perf.avgDispatchH < 48 ? `${Math.round(perf.avgDispatchH)}h` : `${(perf.avgDispatchH / 24).toFixed(1)} days`}</b>
                <span>{perf.openItems} item{perf.openItems === 1 ? "" : "s"} waiting to ship</span>
              </div>
              <div>
                <small>Delivered</small>
                <b>{pct(perf.deliveredRate)}</b>
                <span>of completed items</span>
              </div>
              <div>
                <small>Returns</small>
                <b className={perf.returnRate > 0.08 ? "am-crit-t" : undefined}>{pct(perf.returnRate, 1)}</b>
                <span>of completed items</span>
              </div>
              <div>
                <small>Cancellations</small>
                <b className={perf.cancelRate > 0.1 ? "am-crit-t" : undefined}>{pct(perf.cancelRate, 1)}</b>
                <span>of all items</span>
              </div>
            </div>
          </Card>
        </div>
        <div className="am-span4 ag-stack">
          <Card title="Commission" sub="Platform fee on each item sold — new orders only">
            <CommissionEditor id={s.id} value={s.commissionPct} canEdit={isSuper} />
          </Card>
          <Card title="Money" actions={<Link className="link" href={`${base}?tab=ledger`}>Ledger</Link>}>
            <KeyValues
              rows={[
                ["Ledger balance", <b key="b" className={money.balance < 0 ? "ag-bal neg" : "ag-bal"}>{formatINR(money.balance)}</b>],
                ["In open payouts", formatINR(money.openPayouts)],
                ["Available", <b key="a">{formatINR(money.available)}</b>],
                ["Paid out", formatINR(money.paidOut)],
              ]}
            />
            <div className="ag-row" style={{ marginTop: 12 }}>
              <CreatePayoutButton seller={payoutSeller} canEdit={isSuper} />
              <AdjustmentButton sellers={[{ id: s.id, name: s.displayName }]} sellerId={s.id} canEdit={isSuper} />
            </div>
          </Card>
          <Card title="Account">
            <KeyValues
              rows={[
                ["Login", s.user.email ?? s.user.phone ?? "—"],
                ["Last sign-in", s.user.lastLoginAt ? fmtDateTime(s.user.lastLoginAt) : "Never"],
                ["Store handle", <span className="ag-mono" key="h">{s.slug}</span>],
                ["Seller since", s.approvedAt ? fmtDate(s.approvedAt) : "—"],
              ]}
            />
          </Card>
          <Card title="Sponsored ads" sub="Booked from the seller portal">
            {d.campaigns.length ? (
              <ul className="am-att">
                {d.campaigns.map((c) => (
                  <li key={c.id}>
                    <span className="am-sid">{c.slot.code}</span>
                    <span className="am-att-t">
                      <b>
                        <Link href={`/admin/campaigns/${c.id}`}>{c.name}</Link>
                      </b>
                      <small>
                        {c.code} · {formatINR(c.spent)} spent
                      </small>
                    </span>
                    <StatusPill kind="campaign" status={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="am-muted" style={{ fontSize: 13 }}>No sponsored-product campaigns yet.</p>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        back={{ href: "/admin/sellers", label: "Sellers" }}
        title={
          <>
            <SellerAvatar name={s.displayName} size={40} />
            {s.displayName}
          </>
        }
        badge={<StatusPill kind="seller" status={s.status} />}
        sub={`${s.businessName} · ${[s.city, s.state].filter(Boolean).join(", ") || "—"} · ${s.commissionPct}% commission`}
        actions={<SellerActions id={s.id} name={s.displayName} status={s.status} />}
      />
      {s.rejectionReason && (s.status === "REJECTED" || s.status === "SUSPENDED") ? (
        <div className="ag-reason" role="note">
          <b>{s.status === "SUSPENDED" ? "Suspended" : "Rejected"}</b>
          {s.rejectionReason}
        </div>
      ) : null}
      <StatGrid label="Seller summary">
        <StatCard label="GMV · 30 days" value={formatINR(perf.gmv30)} sub={`${perf.units30} units · ${perf.orders30} orders`} />
        <StatCard label="Ledger balance" value={formatINR(money.balance)} sub={`${formatINR(money.available)} available to pay out`} href={`${base}?tab=ledger`} />
        <StatCard label="Live products" value={d.products.filter((p) => p.status === "ACTIVE").length} sub={`${d.products.filter((p) => p.status === "PENDING").length} awaiting approval · ${d.products.length} total`} href={`${base}?tab=products`} />
        <StatCard label="Items to dispatch" value={perf.openItems} sub={`${pct(perf.deliveredRate)} delivered · ${pct(perf.returnRate, 1)} returned`} href={`${base}?tab=orders`} />
      </StatGrid>
      <LinkTabs
        label="Seller sections"
        items={[
          { href: base, label: "Overview", active: tab === "overview" },
          { href: `${base}?tab=products`, label: "Products", active: tab === "products", count: d.products.length },
          { href: `${base}?tab=orders`, label: "Orders", active: tab === "orders", count: d.items.length },
          { href: `${base}?tab=ledger`, label: "Ledger & payouts", active: tab === "ledger", count: d.payouts.length },
        ]}
      />
      {body}
    </>
  );
}
