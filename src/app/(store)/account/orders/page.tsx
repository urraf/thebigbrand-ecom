import Link from "next/link";
import { Suspense } from "react";
import { requireUserPage } from "@/lib/auth";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { listOrders, orderListQuery, type OrderFilter } from "@/server/orders/customer";
import { OrderRow } from "@/components/commerce/account/order-row";
import { AccSkeleton } from "@/components/commerce/account/skeleton";

export const metadata = { title: "Your orders" };

const FILTERS: [OrderFilter, string][] = [
  ["all", "All"],
  ["active", "On the way"],
  ["delivered", "Delivered"],
  ["unpaid", "Awaiting payment"],
  ["returns", "Returns"],
  ["cancelled", "Cancelled"],
];

/** /account/orders?status=&page= — the shopper's orders with status filters. */
export default function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  return (
    <Suspense fallback={<AccSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/account/orders">["searchParams"] }) {
  const sp = await searchParams;
  const auth = await requireUserPage("/account/orders");
  const parsed = orderListQuery.safeParse({ status: sp.status, page: sp.page, limit: 10 });
  const q = parsed.success ? parsed.data : orderListQuery.parse({});
  const r = await listOrders(auth.user.id, q);
  const href = (status: OrderFilter, page = 1) => `/account/orders${status === "all" && page === 1 ? "" : `?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`}`;
  return (
    <section className="blk cm-acc-sec">
      <div className="co-sec-h">
        <div>
          <h1 className="cm-h1">Your orders</h1>
          <p>{r.counts.all ? `${r.counts.all} order${r.counts.all === 1 ? "" : "s"} · free gifts included in every one` : "Nothing here yet"}</p>
        </div>
      </div>
      <nav className="cm-filters" aria-label="Filter orders">
        {FILTERS.filter(([k]) => k === "all" || k === q.status || r.counts[k] > 0).map(([k, label]) => (
          <Link key={k} href={href(k)} className={cx("chip", q.status === k && "on")} aria-current={q.status === k ? "page" : undefined}>
            {label} <span className="cm-cnt">{r.counts[k]}</span>
          </Link>
        ))}
      </nav>
      {r.items.length ? (
        <ul className="cm-orders">
          {r.items.map((o) => (
            <OrderRow key={o.number} o={o} />
          ))}
        </ul>
      ) : (
        <div className="cm-empty">
          <Icon name="box" />
          <p>
            <b>{q.status === "all" ? "No orders yet" : "No orders in this view"}</b>
            {q.status === "all" ? "When you place an order it will show up here." : "Try another filter."}
          </p>
          <Link className="btn btn-cart" href={q.status === "all" ? "/" : "/account/orders"}>
            {q.status === "all" ? "Start shopping" : "Show all orders"}
          </Link>
        </div>
      )}
      {r.pages > 1 ? (
        <nav className="cm-pager" aria-label="Pages">
          {r.page > 1 ? (
            <Link className="btn btn-ghost btn-sm" href={href(q.status, r.page - 1)}>
              <Icon name="chevLeft" /> Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            Page {r.page} of {r.pages}
          </span>
          {r.page < r.pages ? (
            <Link className="btn btn-ghost btn-sm" href={href(q.status, r.page + 1)}>
              Older <Icon name="chevRight" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
