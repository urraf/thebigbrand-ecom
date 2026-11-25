import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { COURIERS, listOrders, OrderListQuery, orderStats } from "@/server/admin/core/orders";
import { CustomerCell, GiftChips, PAYMENT_SHORT } from "@/components/admin/core/bits";
import { OrderActions } from "@/components/admin/core/order-actions";
import {
  Card,
  DataTable,
  EmptyState,
  FilterChips,
  PageHeader,
  Pagination,
  SkeletonPage,
  StatCard,
  StatGrid,
  StatusPill,
  Toolbar,
  fmtDateTime,
  flatParams,
  type SearchParamsInput,
} from "@/components/admin/ui";

export const metadata = { title: "Orders" };

type Next = "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED";
const NEXT: Record<string, Next | undefined> = { PLACED: "CONFIRMED", CONFIRMED: "PACKED", PACKED: "SHIPPED", SHIPPED: "DELIVERED", OUT_FOR_DELIVERY: "DELIVERED" };

async function Orders({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/orders");
  const params = flatParams(await searchParams);
  const parsed = OrderListQuery.safeParse(params);
  const q = parsed.success ? parsed.data : OrderListQuery.parse({});
  const [list, stats] = await Promise.all([listOrders(q), orderStats()]);
  const c = list.counts;

  return (
    <>
      <StatGrid label="Order summary">
        <StatCard label="Waiting to be confirmed" value={stats.placed} sub="Paid or COD orders just placed" href="/admin/orders?status=PLACED" tone={stats.placed ? "cta" : undefined} />
        <StatCard label="To pack & ship" value={stats.toShip} sub={`${stats.giftsToPack} free gifts to pack with them`} href="/admin/orders?status=CONFIRMED" />
        <StatCard label="In transit" value={stats.transit} sub="Shipped, awaiting delivery" href="/admin/orders?status=SHIPPED" />
        <StatCard label="COD to collect" value={formatINR(stats.codAmount)} sub={`${stats.codCount} cash-on-delivery order${stats.codCount === 1 ? "" : "s"}`} href="/admin/orders?pay=COD_PENDING" />
      </StatGrid>

      <Card
        title="All orders"
        sub="Orders placed on the website and app appear here instantly, with the free gifts chosen before payment."
        id="am-orders"
      >
        <FilterChips
          basePath="/admin/orders"
          params={params}
          param="status"
          label="Filter by status"
          options={[
            { value: "", label: "All", count: c.ALL },
            { value: "PLACED", label: "New", count: c.PLACED },
            { value: "CONFIRMED", label: "Confirmed", count: c.CONFIRMED },
            { value: "PACKED", label: "Packed", count: c.PACKED },
            { value: "SHIPPED", label: "Shipped", count: c.SHIPPED },
            { value: "DELIVERED", label: "Delivered", count: c.DELIVERED },
            { value: "CANCELLED", label: "Cancelled", count: c.CANCELLED },
            { value: "RETURNED", label: "Returns", count: c.RETURNED },
            ...(c.PENDING_PAYMENT ? [{ value: "PENDING_PAYMENT", label: "Awaiting payment", count: c.PENDING_PAYMENT }] : []),
          ]}
        />
        <Toolbar
          search={{ placeholder: "Order number, customer, phone, city…" }}
          filters={[
            {
              param: "method",
              label: "Payment method",
              allLabel: "All payment methods",
              options: [
                { value: "PREPAID", label: "Prepaid (UPI / cards)" },
                { value: "COD", label: "Cash on delivery" },
              ],
            },
            {
              param: "pay",
              label: "Payment status",
              allLabel: "Any payment status",
              options: [
                { value: "PAID", label: "Paid" },
                { value: "COD_PENDING", label: "COD · to collect" },
                { value: "PENDING", label: "Pending" },
                { value: "FAILED", label: "Failed" },
                { value: "REFUNDED", label: "Refunded" },
              ],
            },
          ]}
          dateRange={{ from: "from", to: "to", label: "Placed" }}
        />
        <DataTable
          basePath="/admin/orders"
          params={params}
          sort={{ by: q.sort, dir: q.dir }}
          rows={list.items}
          rowKey={(o) => o.id}
          rowClassName={(o) => (o.status === "PLACED" ? "is-fresh" : undefined)}
          minWidth={1080}
          empty={
            <EmptyState icon="box" title="No orders match">
              Try a different status or clear the filters.
            </EmptyState>
          }
          columns={[
            {
              key: "number",
              label: "Order",
              sortable: "number",
              main: true,
              render: (o) => (
                <>
                  <Link className="am-oid am-rowlink" href={`/admin/orders/${o.number}`}>
                    {o.number}
                  </Link>
                  {o.status === "PLACED" ? <> <span className="am-new">NEW</span></> : null}
                  <small className="am-sub">
                    {fmtDateTime(o.placedAt ?? o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                  </small>
                </>
              ),
            },
            { key: "cust", label: "Customer", render: (o) => <CustomerCell name={o.customer.name} sub={`${o.city} · ${o.phone}`} /> },
            { key: "gifts", label: "Free gifts chosen", render: (o) => <GiftChips gifts={o.gifts} compact /> },
            {
              key: "seller",
              label: "Sold by",
              hideMobile: true,
              render: (o) => <span className="am-sellers">{o.sellers.join(", ")}</span>,
            },
            {
              key: "total",
              label: "Amount",
              align: "right",
              sortable: "total",
              render: (o) => (
                <>
                  <b className="num">{formatINR(o.total)}</b>
                  <small className="am-sub">{PAYMENT_SHORT[o.paymentMethod] ?? o.paymentMethod}</small>
                </>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (o) => (
                <span className="am-stack-pills">
                  <StatusPill kind="order" status={o.status} />
                  {o.paymentStatus === "REFUNDED" || o.paymentStatus === "FAILED" ? <StatusPill kind="payment" status={o.paymentStatus} /> : null}
                </span>
              ),
            },
            {
              key: "act",
              label: "",
              align: "right",
              actions: true,
              render: (o) => {
                const n = NEXT[o.status];
                return n ? (
                  <OrderActions number={o.number} next={[n]} couriers={COURIERS} compact />
                ) : (
                  <Link className="btn btn-ghost btn-sm" href={`/admin/orders/${o.number}`}>
                    View
                  </Link>
                );
              },
            },
          ]}
        />
        <Pagination basePath="/admin/orders" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="orders" />
      </Card>
    </>
  );
}

export default function OrdersPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader title="Orders" sub="Confirm, pack, ship and track every order — each one includes the free TBB gifts chosen at checkout." />
      <Suspense fallback={<SkeletonPage />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </>
  );
}
