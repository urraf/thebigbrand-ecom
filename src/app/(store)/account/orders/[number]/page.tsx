import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUserPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { getOrderDetail } from "@/server/orders/customer";
import { dateTime, STATUS_LABEL } from "@/components/commerce/api";
import { StatusPill } from "@/components/commerce/parts";
import { AccSkeleton } from "@/components/commerce/account/skeleton";
import { BoxList, EventLog, itemsLine, OrderTimeline, paymentSummary, PriceRows } from "@/components/commerce/order/order-parts";
import { CancelOrderButton, PayNowButton, ReturnRequest } from "@/components/commerce/order/order-actions";

export const metadata = { title: "Order details" };

/** /account/orders/:number — full order detail: per-item status / tracking, gifts, address, payment, timeline, actions. */
export default function OrderDetailPage({ params }: PageProps<"/account/orders/[number]">) {
  return (
    <Suspense fallback={<AccSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/account/orders/[number]">["params"] }) {
  const { number } = await params;
  const auth = await requireUserPage(`/account/orders/${number}`);
  if (!/^[A-Z0-9]{6,24}$/i.test(number)) notFound();
  const o = await getOrderDetail(auth.user.id, number);
  if (!o) notFound();
  const pay = paymentSummary(o);
  const a = o.address;
  return (
    <>
      <nav className="cm-crumbs" aria-label="Breadcrumb">
        <Link href="/account/orders">
          <Icon name="chevLeft" /> Your orders
        </Link>
      </nav>
      <header className="blk cm-od-h">
        <div>
          <h1 className="cm-h1">
            Order #{o.number} <StatusPill status={o.status} label={STATUS_LABEL[o.status] ?? o.status} />
          </h1>
          <p className="muted">
            Ordered {dateTime(o.placedAt ?? o.createdAt)} · {itemsLine(o)} · {formatINR(o.total)}
          </p>
        </div>
        <div className="cm-od-acts">
          {o.canPay ? <PayNowButton number={o.number} label={`Pay ${formatINR(o.total)}`} className="btn btn-cart" /> : null}
          {o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" ? (
            <Link className="btn btn-ghost" href={`/account/orders/${o.number}/invoice`}>
              <Icon name="layers" /> Invoice
            </Link>
          ) : null}
          {o.canCancel ? <CancelOrderButton number={o.number} unpaid={o.status === "PENDING_PAYMENT"} /> : null}
        </div>
      </header>
      {o.refundNote ? (
        <p className="cm-alert is-info">
          <Icon name="info" />
          <span>{o.refundNote}</span>
        </p>
      ) : null}
      {o.status !== "PENDING_PAYMENT" ? (
        <section className="blk cm-acc-sec">
          <OrderTimeline o={o} />
        </section>
      ) : (
        <p className="cm-alert is-warn">
          <Icon name="clock" />
          <span>This order is waiting for payment. It&rsquo;s reserved for 30 minutes from checkout, then cancelled automatically (nothing is charged).</span>
        </p>
      )}
      <div className="cm-od-grid">
        <div className="cm-od-main">
          <section className="blk cm-acc-sec" aria-labelledby="od-items">
            <div className="co-sec-h">
              <div>
                <h2 id="od-items">Items &amp; free gifts</h2>
                <p>Each item ships from its seller; free gifts are packed with the first parcel.</p>
              </div>
            </div>
            <BoxList o={o} showStatus />
            {o.canReturn ? (
              <div className="cm-od-ret">
                <ReturnRequest number={o.number} items={o.items} />
              </div>
            ) : null}
          </section>
          <section className="blk cm-acc-sec" aria-labelledby="od-log">
            <div className="co-sec-h">
              <div>
                <h2 id="od-log">Order history</h2>
              </div>
            </div>
            <EventLog o={o} />
          </section>
        </div>
        <aside className="cm-od-side">
          <section className="blk cm-acc-sec">
            <h2 className="cm-h2">Delivery address</h2>
            <p className="cm-addr">
              <b>{a.name}</b>
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              {a.landmark ? `, ${a.landmark}` : ""}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              +91 {a.phone}
            </p>
          </section>
          <section className="blk cm-acc-sec">
            <h2 className="cm-h2">Payment</h2>
            <p className="cm-addr">
              <b>{pay.label}</b>
              <br />
              {pay.sub}
            </p>
            <PriceRows o={o} />
          </section>
          <p className="cm-help">
            <Icon name="phone" /> Need help with this order? Call 1800 120 4455 (9 am – 9 pm)
          </p>
        </aside>
      </div>
    </>
  );
}
