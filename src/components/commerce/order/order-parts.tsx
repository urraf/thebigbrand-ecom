/** Order display pieces shared by the confirmation page and the account order detail. Server-safe. */
import Link from "next/link";
import { formatINR } from "@/lib/money";
import type { OrderDetail } from "@/server/checkout/types";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { dateTime, plural, shortDate, STATUS_LABEL } from "../api";
import { SnapArt, StatusPill } from "../parts";

const RANK: Record<string, number> = { PENDING_PAYMENT: 0, PLACED: 1, CONFIRMED: 2, PACKED: 3, SHIPPED: 4, OUT_FOR_DELIVERY: 5, DELIVERED: 6 };

/** Order progress: Placed → Packed → Shipped → Delivered (or → Cancelled / Returned), dated from OrderEvents. */
export function OrderTimeline({ o }: { o: OrderDetail }) {
  const at = (s: string) => o.events.find((e) => e.status === s)?.at ?? null;
  const rank = RANK[o.status] ?? (o.status === "RETURNED" || o.status === "RETURN_REQUESTED" || o.status === "REFUNDED" ? 6 : 0);
  const eta = o.eta ? shortDate(o.eta) : null;
  type Step = { key: string; label: string; icon: IconName; on: boolean; when: string | null; bad?: boolean };
  const steps: Step[] = [
    { key: "PLACED", label: "Order placed", icon: "check", on: rank >= 1, when: o.placedAt ? shortDate(o.placedAt) : null },
    { key: "PACKED", label: "Packed with your gifts", icon: "box", on: rank >= 3, when: at("PACKED") ? shortDate(at("PACKED")!) : rank < 3 && eta ? "Within 24 hours" : null },
    { key: "SHIPPED", label: "Shipped", icon: "truck", on: rank >= 4, when: at("SHIPPED") ? shortDate(at("SHIPPED")!) : null },
    { key: "DELIVERED", label: "Delivered", icon: "home", on: rank >= 6, when: o.deliveredAt ? shortDate(o.deliveredAt) : eta ? `Expected ${eta}` : null },
  ];
  if (o.status === "CANCELLED") {
    const placed = steps[0];
    return (
      <ol className="co-tl is-cancel" aria-label="Order progress">
        <li className={cx(placed.on && "is-on")}>
          <i>
            <Icon name="check" />
          </i>
          <b>{placed.on ? "Order placed" : "Order created"}</b>
          <small>{shortDate(o.placedAt ?? o.createdAt)}</small>
        </li>
        <li className="is-on is-bad">
          <i>
            <Icon name="close" />
          </i>
          <b>Cancelled</b>
          <small>{o.cancelledAt ? shortDate(o.cancelledAt) : ""}</small>
        </li>
      </ol>
    );
  }
  return (
    <ol className="co-tl" aria-label="Order progress">
      {steps.map((s) => (
        <li key={s.key} className={cx(s.on && "is-on")}>
          <i>
            <Icon name={s.on ? "check" : s.icon} />
          </i>
          <b>{s.label}</b>
          <small>{s.when ?? ""}</small>
        </li>
      ))}
    </ol>
  );
}

/** Full event log (customer-friendly actor labels). */
export function EventLog({ o }: { o: OrderDetail }) {
  if (!o.events.length) return null;
  const who = (a: string | null) => (!a ? "" : a === "customer" ? "You" : a === "system" ? "The Big Brands" : a.startsWith("seller:") ? "Seller" : a.startsWith("admin:") ? "Our team" : "");
  return (
    <ol className="cm-log">
      {[...o.events].reverse().map((e) => (
        <li key={e.id}>
          <span className="cm-log-dot" aria-hidden="true" />
          <div>
            <b>{e.note?.startsWith("Return requested") ? "Return requested" : (STATUS_LABEL[e.status] ?? e.status)}</b>
            {e.note ? <p>{e.note}</p> : null}
            <small>
              {dateTime(e.at)}
              {who(e.actor) ? ` · ${who(e.actor)}` : ""}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "What's in your box" — items + free gifts with FREE badges. */
export function BoxList({ o, showStatus = false }: { o: OrderDetail; showStatus?: boolean }) {
  return (
    <ul className="co-bx-list">
      {o.items.map((i) => (
        <li key={i.id} className={cx("co-bx", showStatus && "cm-bx-st")}>
          <SnapArt name={i.name} brandName={i.brandName} imageUrl={i.imageUrl} art={i.art} own={i.isOwnLabel} className="co-bx-art" sizes="60px" />
          <span className="co-bx-n">
            {i.slug ? (
              <Link href={`/p/${i.slug}`} prefetch={false}>
                <b>{i.name}</b>
              </Link>
            ) : (
              <b>{i.name}</b>
            )}
            <small>
              {i.brandName}
              {i.size ? ` · ${i.size}` : ""} · Qty {i.qty}
              {showStatus ? ` · Sold by ${i.sellerName}` : ""}
            </small>
            {showStatus ? (
              <span className="cm-bx-meta">
                <StatusPill status={i.status} label={STATUS_LABEL[i.status] ?? i.status} />
                {i.courier || i.trackingNumber ? (
                  <span className="cm-track">
                    <Icon name="truck" />
                    {i.courier ?? "Courier"}
                    {i.trackingNumber ? (
                      <>
                        {" "}
                        · <code>{i.trackingNumber}</code>
                      </>
                    ) : null}
                  </span>
                ) : null}
                {i.returnRequested ? <span className="cm-track">Return requested</span> : i.returnable && i.returnBy ? <span className="cm-track">Returnable till {shortDate(i.returnBy)}</span> : null}
              </span>
            ) : null}
          </span>
          <span className="co-bx-p">{formatINR(i.lineTotal)}</span>
        </li>
      ))}
      {o.gifts.map((g) => (
        <li key={g.id} className="co-bx is-gift">
          <SnapArt name={g.name} brandName="TBB Originals" imageUrl={g.imageUrl} art={g.art} own className="co-bx-art" sizes="60px" />
          <span className="co-bx-n">
            <b>{g.name}</b>
            <small>TBB Originals · {g.miniSize} · your free gift</small>
          </span>
          <span className="co-bx-p">
            <span className="co-freeb">FREE</span>
            <s>{formatINR(g.worth)}</s>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PriceRows({ o }: { o: OrderDetail }) {
  return (
    <>
      <dl className="co-rows">
        <div>
          <dt>Items at M.R.P.</dt>
          <dd>{formatINR(o.mrpTotal)}</dd>
        </div>
        {o.mrpTotal > o.subtotal ? (
          <div className="is-save">
            <dt>Discount on M.R.P.</dt>
            <dd>−{formatINR(o.mrpTotal - o.subtotal)}</dd>
          </div>
        ) : null}
        {o.discount ? (
          <div className="is-save">
            <dt>
              <Icon name="tag" />
              Coupon {o.couponCode}
            </dt>
            <dd>−{formatINR(o.discount)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Delivery</dt>
          <dd>{o.shippingFee ? formatINR(o.shippingFee) : <span className="free">FREE</span>}</dd>
        </div>
        {o.codFee ? (
          <div>
            <dt>Cash on delivery fee</dt>
            <dd>{formatINR(o.codFee)}</dd>
          </div>
        ) : null}
        {o.gifts.length ? (
          <div className="is-gift">
            <dt>
              <Icon name="gift" />
              Free gifts ({o.gifts.length})
            </dt>
            <dd>
              <s>{formatINR(o.giftWorth)}</s> <span className="free">₹0</span>
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="co-sum-total">
        <span>Order total</span>
        <b>{formatINR(o.total)}</b>
      </div>
      {o.savings > 0 ? (
        <p className="co-sum-save">
          <Icon name="sparkle" />
          <span>
            You saved <b>{formatINR(o.savings)}</b> on this order
          </span>
        </p>
      ) : null}
    </>
  );
}

export function paymentSummary(o: OrderDetail): { label: string; sub: string } {
  if (o.paymentMethod === "COD") return { label: "Cash on delivery", sub: o.paymentStatus === "PAID" ? `${formatINR(o.total)} paid` : `Pay ${formatINR(o.total)} on delivery` };
  const label = o.paymentMethod === "TEST" ? "Online · test gateway" : "Online · Razorpay";
  const sub =
    o.paymentStatus === "PAID" ? `${formatINR(o.total)} paid` : o.paymentStatus === "REFUNDED" ? "Refunded" : o.status === "PENDING_PAYMENT" ? "Awaiting payment" : o.paymentStatus === "FAILED" ? "Payment failed" : "Pending";
  return { label, sub };
}

export function itemsLine(o: OrderDetail) {
  const n = o.items.reduce((a, i) => a + i.qty, 0);
  return `${plural(n, "item")} + ${plural(o.gifts.length, "free gift")}`;
}
