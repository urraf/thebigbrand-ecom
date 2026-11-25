import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { COURIERS, getOrderDetail } from "@/server/admin/core/orders";
import { ItemActions, NoteForm, OrderActions, RefundButton } from "@/components/admin/core/order-actions";
import { CustomerCell, PAYMENT_LABEL } from "@/components/admin/core/bits";
import { Card, KeyValues, PageHeader, SkeletonTable, StatusPill, fmtDateTime, statusLabel } from "@/components/admin/ui";
import { ProductImage } from "@/components/ui/product-image";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Order" };

async function OrderDetail({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  await requireAdminPage(`/admin/orders/${number}`);
  const o = await getOrderDetail(decodeURIComponent(number));
  if (!o) notFound();
  const savings = o.mrpTotal - o.subtotal;
  const giftWorth = o.gifts.reduce((t, g) => t + g.worth, 0);
  // an event whose status equals the previous one is a note / payment record, not a status change
  const timeline = o.events.map((e, i) => ({ ...e, isNote: i > 0 && o.events[i - 1].status === e.status })).reverse();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={<span className="am-oid">Order {o.number}</span>}
        badge={
          <>
            <StatusPill kind="order" status={o.status} />
            <StatusPill kind="payment" status={o.paymentStatus} />
          </>
        }
        sub={`Placed ${fmtDateTime(o.placedAt ?? o.createdAt)} · ${PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod} · ${o.items.reduce((t, i) => t + i.qty, 0)} items`}
        actions={
          <>
            <OrderActions number={o.number} next={o.next} couriers={COURIERS} />
            {o.canRefund ? <RefundButton number={o.number} amount={formatINR(o.total)} /> : null}
            <Link className="btn btn-ghost btn-sm" href={`/admin/orders/${o.number}/invoice`}>
              <Icon name="card" />
              Invoice
            </Link>
          </>
        }
      />

      <div className="am-grid">
        <div className="am-span8 am-col-stack">
          <Card title="Items" sub={`${o.items.length} line${o.items.length === 1 ? "" : "s"} · each line can be moved on its own (e.g. a seller ships separately)`} id="am-items">
            <ul className="am-oitems">
              {o.items.map((i) => (
                <li key={i.id} className={i.status === "CANCELLED" || i.status === "RETURNED" ? "is-off" : undefined}>
                  <ProductImage
                    className="am-oimg"
                    sizes="64px"
                    product={{ name: i.name, image: i.imageUrl ? { url: i.imageUrl, alt: i.name, width: null, height: null } : null, art: i.art, isOwnLabel: i.isOwnLabel, brand: i.brand }}
                  />
                  <div className="am-oitem-b">
                    <div className="am-oitem-t">
                      <div>
                        <small className="am-oitem-brand">{i.brandName}</small>
                        <Link href={`/admin/products/${i.productId}`} className="am-oitem-n">
                          {i.name}
                        </Link>
                        <small className="am-sub">
                          {i.size ? `${i.size} · ` : ""}
                          {i.sku ? `SKU ${i.sku} · ` : ""}
                          {i.qty} × {formatINR(i.price)}
                          {i.mrp > i.price ? <s className="am-muted"> {formatINR(i.mrp)}</s> : null}
                        </small>
                      </div>
                      <b className="num am-oitem-amt">{formatINR(i.lineTotal)}</b>
                    </div>
                    <div className="am-oitem-meta">
                      <StatusPill kind="item" status={i.status} />
                      <span className="am-tag">
                        <Icon name="store" />
                        {i.seller ? i.seller.displayName : "The Big Brands Retail"}
                      </span>
                      {i.seller ? (
                        <span className="am-muted am-oitem-comm">
                          {i.commissionPct}% commission {formatINR(i.commissionAmt)} · seller earns {formatINR(i.sellerEarning)}
                        </span>
                      ) : null}
                      {i.courier ? (
                        <span className="am-tag am-tag-violet">
                          <Icon name="truck" />
                          {i.courier}
                          {i.trackingNumber ? ` · ${i.trackingNumber}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <ItemActions number={o.number} itemId={i.id} name={i.name} next={i.next} couriers={COURIERS} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Free gifts chosen" sub={o.gifts.length ? `Picked by the customer before payment · worth ${formatINR(giftWorth)} — pack them with the order` : undefined} id="am-gifts">
            {o.gifts.length ? (
              <ul className="am-ogifts">
                {o.gifts.map((g) => (
                  <li key={g.id}>
                    <span className="am-ogift-ic" style={{ background: `color-mix(in srgb, ${g.c1 && /^#[0-9a-f]{3,6}$/i.test(g.c1) ? g.c1 : "#ff3d6e"} 16%, #fff)` }}>
                      <Icon name="gift" />
                    </span>
                    <span>
                      <b>{g.name}</b>
                      <small>
                        {g.miniSize} · worth {formatINR(g.worth)}
                      </small>
                    </span>
                    <span className="free">FREE</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="am-muted">No gifts were chosen for this order.</p>
            )}
          </Card>

          <Card title="Timeline" sub="Every status change, by whom — customers see status changes on their order page" id="am-tl">
            <ol className="am-tl">
              {timeline.map((e) => (
                <li key={e.id} className={e.isNote ? "is-note" : undefined}>
                  <span className="am-tl-dot" aria-hidden="true" />
                  <div>
                    <b>{e.isNote ? (e.note?.startsWith("Refund") ? "Refund" : "Note") : statusLabel("order", e.status)}</b>
                    {e.note ? <p>{e.note}</p> : null}
                    <small>
                      {fmtDateTime(e.createdAt)} · {e.actorName}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            <NoteForm number={o.number} />
          </Card>
        </div>

        <div className="am-span4 am-col-stack">
          <Card title="Payment summary" id="am-sum">
            <dl className="am-sumlist">
              <div>
                <dt>MRP total</dt>
                <dd>{formatINR(o.mrpTotal)}</dd>
              </div>
              {savings > 0 ? (
                <div className="am-sum-save">
                  <dt>Discount on MRP</dt>
                  <dd>−{formatINR(savings)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Subtotal</dt>
                <dd>{formatINR(o.subtotal)}</dd>
              </div>
              {o.discount ? (
                <div className="am-sum-save">
                  <dt>Coupon {o.couponCode ? <span className="am-tag">{o.couponCode}</span> : null}</dt>
                  <dd>−{formatINR(o.discount)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Shipping</dt>
                <dd>{o.shippingFee ? formatINR(o.shippingFee) : <span className="free">FREE</span>}</dd>
              </div>
              {o.codFee ? (
                <div>
                  <dt>COD fee</dt>
                  <dd>{formatINR(o.codFee)}</dd>
                </div>
              ) : null}
              {o.gifts.length ? (
                <div>
                  <dt>Free gifts ({o.gifts.length})</dt>
                  <dd>
                    <span className="free">FREE</span>
                  </dd>
                </div>
              ) : null}
              <div className="am-sum-total">
                <dt>Order total</dt>
                <dd>{formatINR(o.total)}</dd>
              </div>
            </dl>
            <div className="am-sum-pay">
              <span>{PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
              <StatusPill kind="payment" status={o.paymentStatus} />
            </div>
            {o.payments.length ? (
              <ul className="am-pays">
                {o.payments.map((p) => (
                  <li key={p.id}>
                    <span>
                      <b>
                        {p.provider} · {formatINR(p.amount)}
                      </b>
                      <small>
                        {fmtDateTime(p.createdAt)}
                        {p.providerPaymentId ? ` · ${p.providerPaymentId}` : p.providerOrderId ? ` · ${p.providerOrderId}` : ""}
                      </small>
                    </span>
                    <StatusPill kind="payment" status={p.status} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card
            title="Customer"
            id="am-cust"
            actions={
              <Link className="link" href={`/admin/customers/${o.customer.id}`}>
                Profile <Icon name="chevRight" />
              </Link>
            }
          >
            <CustomerCell name={o.customer.name || o.address.name} sub={`${o.customer.orderCount} order${o.customer.orderCount === 1 ? "" : "s"} · customer since ${new Date(o.customer.createdAt).getFullYear()}`} />
            <KeyValues
              rows={[
                ["Email", o.customer.email ? <a href={`mailto:${o.customer.email}`}>{o.customer.email}</a> : "—"],
                ["Mobile", o.customer.phone ? <a href={`tel:+91${o.customer.phone}`}>+91 {o.customer.phone}</a> : "—"],
                !o.customer.isActive ? ["Account", <span className="am-crit-t" key="d">Disabled</span>] : null,
              ]}
            />
          </Card>

          <Card title="Ship to" id="am-ship">
            <address className="am-addr">
              <b>{o.address.name}</b>
              <span>{o.address.line1}</span>
              {o.address.line2 ? <span>{o.address.line2}</span> : null}
              {o.address.landmark ? <span>Near {o.address.landmark}</span> : null}
              <span>
                {o.address.city}, {o.address.state} {o.address.pincode}
              </span>
              <span>
                <Icon name="phone" /> +91 {o.address.phone}
              </span>
            </address>
            {o.notes ? (
              <p className="am-onote">
                <b>Customer note:</b> {o.notes}
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader back={{ href: "/admin/orders", label: "Orders" }} title="Order" sub="Loading…" />
          <div className="am-grid">
            <div className="am-span8">
              <SkeletonTable rows={6} />
            </div>
            <div className="am-span4">
              <SkeletonTable rows={5} />
            </div>
          </div>
        </>
      }
    >
      <OrderDetail params={params} />
    </Suspense>
  );
}
