import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { BodySkeleton, PageHead, Pill } from "@/components/seller/page-head";
import { OrderActions } from "@/components/seller/order-actions";
import { Thumb } from "@/components/seller/thumb";
import { ITEM_STATUS_LABEL, STATUS_TONE, fmtDayTime, plural } from "@/components/seller/format";
import { ORDER_TAB_KEYS, listSellerOrders, type OrderTab, type SellerOrder } from "@/server/seller/orders";
import { getSellerHref } from "@/server/seller/host";

export const metadata: Metadata = { title: "Orders" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function SellerOrdersPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHead title="Orders" sub="Confirm, pack and ship your items. Only your items in each order are shown." />
      <Suspense fallback={<BodySkeleton rows={[56, 180, 180, 180]} />}>
        <OrdersBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const TAB_LABEL: Record<OrderTab, string> = {
  all: "All",
  open: "To ship",
  new: "New",
  confirmed: "To pack",
  packed: "Ready to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  closed: "Cancelled & returns",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const STEPS = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as const;

async function OrdersBody({ searchParams }: { searchParams: SP }) {
  const { seller } = await requireSellerPage("/seller/orders");
  const sp = await searchParams;
  const tab = (ORDER_TAB_KEYS as string[]).includes(one(sp.status)) ? (one(sp.status) as OrderTab) : "all";
  const q = one(sp.q).trim().slice(0, 60);
  const from = isDay(one(sp.from)) ? one(sp.from) : "";
  const to = isDay(one(sp.to)) ? one(sp.to) : "";
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);
  const [data, href] = await Promise.all([listSellerOrders(seller.id, { tab, q, from, to, page }), getSellerHref()]);

  const qs = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | number | null> = { status: tab === "all" ? null : tab, q: q || null, from: from || null, to: to || null, page: null, ...over };
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return href(`/seller/orders${s ? `?${s}` : ""}`);
  };
  const filtered = !!(q || from || to);

  return (
    <div className="sl-body">
      <div className="sl-filters">
        <nav className="sl-tabs" aria-label="Order status">
          {ORDER_TAB_KEYS.filter((k) => k !== "open" || data.counts.open > 0 || tab === "open").map((k) => (
            <Link key={k} href={qs({ status: k === "all" ? null : k })} className={tab === k ? "chip on" : "chip"} aria-current={tab === k ? "page" : undefined}>
              {TAB_LABEL[k]} <span className="sl-chip-n">{data.counts[k]}</span>
            </Link>
          ))}
        </nav>
        <Form className="sl-filters" style={{ flex: "1 1 100%" }} role="search" action={href("/seller/orders")}>
          {tab !== "all" ? <input type="hidden" name="status" value={tab} /> : null}
          <label className="sl-search">
            <Icon name="search" />
            <span className="sr-only">Search orders</span>
            <input type="search" name="q" defaultValue={q} placeholder="Order number, product or customer name" />
          </label>
          <label className="sl-date">
            From <input type="date" name="from" defaultValue={from} aria-label="From date" />
          </label>
          <label className="sl-date">
            To <input type="date" name="to" defaultValue={to} aria-label="To date" />
          </label>
          <button type="submit" className="btn btn-dark btn-sm">
            Apply
          </button>
          {filtered ? (
            <Link href={qs({ q: null, from: null, to: null })} className="btn btn-ghost btn-sm">
              Clear
            </Link>
          ) : null}
        </Form>
      </div>

      {data.items.length ? (
        <div className="sl-orders">
          {data.items.map((o) => (
            <OrderCard key={o.id} o={o} detailHref={href(`/seller/orders/${o.number}`)} />
          ))}
        </div>
      ) : (
        <div className="sl-card sl-empty">
          <Icon name="box" />
          <b>{filtered ? "No orders match those filters" : tab === "all" ? "No orders yet" : `Nothing in “${TAB_LABEL[tab]}”`}</b>
          <p>
            {filtered
              ? "Try a different order number, product name or date range."
              : tab === "all"
                ? "When a shopper pays for one of your products, the order lands here with everything you need to ship it."
                : "You're all caught up here."}
          </p>
          {filtered ? (
            <Link href={qs({ q: null, from: null, to: null })} className="btn btn-ghost">
              Clear filters
            </Link>
          ) : null}
        </div>
      )}

      {data.pages > 1 ? (
        <div className="sl-pager">
          <span>
            Page {data.page} of {data.pages} · {plural(data.total, "order")}
          </span>
          <div>
            {data.page > 1 ? (
              <Link className="btn btn-ghost btn-sm" href={qs({ page: data.page - 1 })}>
                <Icon name="chevLeft" /> Newer
              </Link>
            ) : null}
            {data.page < data.pages ? (
              <Link className="btn btn-ghost btn-sm" href={qs({ page: data.page + 1 })}>
                Older <Icon name="chevRight" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderCard({ o, detailHref }: { o: SellerOrder; detailHref: string }) {
  const count = (s: string) => o.items.filter((i) => i.status === s).length;
  const closed = o.stage === "CANCELLED" || o.stage === "RETURNED";
  const stepIdx = STEPS.indexOf(o.stage as (typeof STEPS)[number]);
  return (
    <article className="sl-order" aria-labelledby={`o-${o.id}`}>
      <div className="sl-order-h">
        <Link id={`o-${o.id}`} href={detailHref} className="sl-oid">
          {o.number}
        </Link>
        <span>
          <Icon name="clock" /> {fmtDayTime(o.placedAt)}
        </span>
        <span>
          <Icon name="card" /> {o.payment}
        </span>
        <span className="sl-spacer" />
        {closed ? null : (
          <ol className="sl-steps" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className={i < stepIdx || o.stage === "DELIVERED" ? "done" : i === stepIdx ? "cur" : undefined}>
                <i aria-hidden="true" />
                {ITEM_STATUS_LABEL[s]}
              </li>
            ))}
          </ol>
        )}
        <Pill tone={STATUS_TONE[o.stage]}>{ITEM_STATUS_LABEL[o.stage]}</Pill>
      </div>
      <div className="sl-order-b">
        <div className="sl-lines">
          {o.items.map((i) => (
            <div className="sl-line" key={i.id}>
              <Thumb name={i.name} brand={i.brandName} image={i.imageUrl} art={i.art} />
              <span>
                <b>{i.name}</b>
                <small>
                  {i.brandName}
                  {i.size ? ` · ${i.size}` : ""}
                  {i.sku ? ` · SKU ${i.sku}` : ""}
                </small>
                {i.trackingNumber ? (
                  <span className="sl-track">
                    <Icon name="truck" /> {i.courier} · <b>{i.trackingNumber}</b>
                  </span>
                ) : o.items.length > 1 ? (
                  <small>{ITEM_STATUS_LABEL[i.status]}</small>
                ) : null}
              </span>
              <span className="r">
                <b className="num">
                  {i.qty} × {formatINR(i.price)}
                </b>
                <small className="sl-muted">{i.status === "CANCELLED" ? "Cancelled" : `you earn ${formatINR(i.sellerEarning)}`}</small>
              </span>
            </div>
          ))}
        </div>
        <div className="sl-shipto">
          <b>
            <Icon name="pin" />
            {o.shipTo.name}
          </b>
          {o.shipTo.city}, {o.shipTo.state} {o.shipTo.pincode}
          {o.shipTo.phoneMasked ? (
            <>
              <br />
              <Icon name="phone" />
              {o.shipTo.phoneMasked}
            </>
          ) : null}
        </div>
        <OrderActions number={o.number} placed={count("PLACED")} confirmed={count("CONFIRMED")} packed={count("PACKED")} compact />
      </div>
    </article>
  );
}
