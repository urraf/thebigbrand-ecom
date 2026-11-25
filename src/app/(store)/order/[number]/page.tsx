import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { getAuth } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { AdZone } from "@/components/ads";
import { Icon } from "@/components/ui/icon";
import { ProductCard } from "@/components/ui/product-card";
import { firstNameOf } from "@/server/cart/session";
import { getOrderDetail } from "@/server/orders/customer";
import { getFullSizeOriginals } from "@/server/gifts/service";
import { shortDate } from "@/components/commerce/api";
import { XIcon } from "@/components/commerce/parts";
import { BoxList, itemsLine, OrderTimeline, paymentSummary, PriceRows } from "@/components/commerce/order/order-parts";
import { CancelOrderButton, CopyCode, PayNowButton } from "@/components/commerce/order/order-actions";
import "@/styles/commerce/checkout.css";
import "@/styles/commerce/commerce.css";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

const CONFETTI = ["#ff3d6e", "#ffc94d", "#0f9f6e", "#5b35e0", "#ff7a45"];

/** /order/:number — the order confirmation (owner only). */
export default function OrderPage({ params }: PageProps<"/order/[number]">) {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <OrderLoader params={params} />
    </Suspense>
  );
}

async function OrderLoader({ params }: { params: PageProps<"/order/[number]">["params"] }) {
  const { number } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/login?next=${encodeURIComponent(`/order/${number}`)}`);
  if (!/^[A-Z0-9]{6,24}$/i.test(number)) notFound();
  const o = await getOrderDetail(auth.user.id, number);
  if (!o) notFound();

  const name = firstNameOf(auth.user.name ?? o.address.name, "");
  const pay = paymentSummary(o);
  const unpaid = o.status === "PENDING_PAYMENT";
  const cancelled = o.status === "CANCELLED";
  const love = await getFullSizeOriginals(o.gifts.map((g) => g.productId), 4);
  const pickedProducts = new Set(o.gifts.map((g) => g.productId));
  const count = o.items.reduce((a, i) => a + i.qty, 0);

  return (
    <section className="wrap co-page co-ok">
      <div className={`blk co-ok-hero${unpaid ? " is-pending" : cancelled ? " is-cancelled" : ""}`}>
        <div className="co-ok-main">
          {unpaid || cancelled ? (
            <div className={`cm-ok-ic ${cancelled ? "is-bad" : "is-warn"}`} aria-hidden="true">
              <Icon name={cancelled ? "close" : "clock"} />
            </div>
          ) : (
            <div className="co-ok-check" aria-hidden="true">
              <span className="co-confetti">
                {Array.from({ length: 14 }, (_, i) => (
                  <i key={i} style={{ "--a": `${i * (360 / 14)}deg`, "--d": `${58 + (i % 3) * 14}px`, "--c": CONFETTI[i % 5] } as CSSProperties} />
                ))}
              </span>
              <svg viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="29" />
                <path d="M19 33.5l8.5 8.5L45.5 23" />
              </svg>
            </div>
          )}
          <div className="co-ok-t">
            {unpaid ? (
              <>
                <p className="co-ok-k cm-k-warn">Payment pending</p>
                <h1>Complete your payment{name ? `, ${name}` : ""}</h1>
                <p>
                  Order <b>#{o.number}</b> is reserved for 30 minutes from checkout. Nothing has been charged yet.
                </p>
              </>
            ) : cancelled ? (
              <>
                <p className="co-ok-k cm-k-bad">Order cancelled</p>
                <h1>Order #{o.number} was cancelled</h1>
                <p>{o.refundNote ?? "Nothing was charged. Your free gifts and coupon have been released."}</p>
              </>
            ) : (
              <>
                <p className="co-ok-k">Order placed · Thank you!</p>
                <h1>Your order is confirmed{name ? `, ${name}` : ""}.</h1>
                <p>
                  Order <b>#{o.number}</b> — we&rsquo;ll send updates by SMS to <b>+91 {o.address.phone}</b>.
                </p>
              </>
            )}
          </div>
        </div>
        {unpaid ? (
          <div className="cm-ok-acts">
            {o.canPay ? <PayNowButton number={o.number} label={`Pay ${formatINR(o.total)}`} /> : null}
            {o.canCancel ? <CancelOrderButton number={o.number} unpaid /> : null}
            <Link className="btn btn-ghost" href="/checkout">
              Back to checkout
            </Link>
          </div>
        ) : null}
        <dl className="co-ok-facts">
          <div>
            <dt>
              <Icon name="truck" />
              {o.status === "DELIVERED" ? "Delivered" : "Arriving"}
            </dt>
            <dd>
              {o.deliveredAt ? shortDate(o.deliveredAt) : o.eta ? shortDate(o.eta) : cancelled ? "—" : "2–4 days"}
              <small>{o.shippingFee ? `Delivery ${formatINR(o.shippingFee)}` : "FREE delivery"}</small>
            </dd>
          </div>
          <div>
            <dt>
              <XIcon name={o.paymentMethod === "COD" ? "cash" : "lock"} />
              Payment
            </dt>
            <dd>
              {pay.label}
              <small>{pay.sub}</small>
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="pin" />
              Delivering to
            </dt>
            <dd>
              {o.address.name}
              <small>
                {o.address.city} {o.address.pincode}
              </small>
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="gift" />
              Free gifts
            </dt>
            <dd>
              {o.gifts.length ? `${o.gifts.length} gift${o.gifts.length === 1 ? "" : "s"}` : "None"}
              <small>{o.giftWorth ? `worth ${formatINR(o.giftWorth)}` : "TBB Originals"}</small>
            </dd>
          </div>
        </dl>
        {!unpaid ? <OrderTimeline o={o} /> : null}
      </div>

      <div className="co-ok-grid">
        <section className="blk co-box" aria-labelledby="co-box-h">
          <div className="co-sec-h">
            <div>
              <h2 id="co-box-h">What&rsquo;s in your box</h2>
              <p>{itemsLine(o)}, packed together</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href={`/account/orders/${o.number}`}>
              <Icon name="truck" /> Track order
            </Link>
          </div>
          <BoxList o={o} />
          <div className="co-bx-tot">
            <span>
              {o.paymentMethod === "COD" ? "To pay on delivery" : o.paymentStatus === "PAID" ? "Paid" : "Order total"} <b>{formatINR(o.total)}</b>
            </span>
            {o.savings ? (
              <span className="co-bx-save">
                <Icon name="sparkle" />
                You saved {formatINR(o.savings)}
              </span>
            ) : null}
          </div>
          <details className="cm-bill">
            <summary>Price details · {count} items</summary>
            <PriceRows o={o} />
          </details>
        </section>
        <aside className="co-ok-side">
          <AdZone code="C2" context={{ productId: o.items[0]?.productId }} />
          <Link className="co-admin" href="/account/orders">
            <Icon name="box" />
            <span>
              <b>All your orders</b>
              <small>Track deliveries, download invoices, request returns.</small>
            </span>
            <Icon name="arrow" />
          </Link>
        </aside>
      </div>

      {!cancelled && love.length ? (
        <section className="blk co-love" aria-labelledby="co-love-h">
          <div className="co-love-intro">
            <span className="co-house">
              <Icon name="sparkle" />
              The Big Brands · TBB Originals
            </span>
            <h2 id="co-love-h">Loved your free gift? Get the full size at 20% off</h2>
            <p>Your minis are on the way. When you&rsquo;re ready for more, use the code below on any TBB Originals full size.</p>
            <CopyCode code="LOVEDIT" message="Code LOVEDIT copied — 20% off any TBB Originals full size" />
          </div>
          <div className="co-love-grid">
            {love.map((p) => (
              <div key={p.id} className={`co-love-it${pickedProducts.has(p.id) ? " is-picked" : ""}`}>
                <span className="co-love-tag">
                  <span>
                    {pickedProducts.has(p.id) ? (
                      <>
                        <Icon name="gift" />
                        In your box
                      </>
                    ) : (
                      "Try next"
                    )}
                  </span>
                  <span>
                    <b>{formatINR(Math.round(p.price * 0.8))}</b> with LOVEDIT
                  </span>
                </span>
                <ProductCard product={p} compact />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <p className="co-ok-more">
        <Link className="btn btn-dark btn-lg" href="/">
          Continue shopping <Icon name="arrow" />
        </Link>
      </p>
    </section>
  );
}

function OrderSkeleton() {
  return (
    <section className="wrap co-page" aria-busy="true" aria-label="Loading your order">
      <div className="cm-sk cm-sk-hero" />
      <div className="co-ok-grid">
        <div className="cm-sk cm-sk-block" />
        <div className="cm-sk cm-sk-block" />
      </div>
    </section>
  );
}
