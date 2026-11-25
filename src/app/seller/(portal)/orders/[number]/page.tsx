import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { BodySkeleton, PageHead, Pill } from "@/components/seller/page-head";
import { OrderActions } from "@/components/seller/order-actions";
import { Thumb } from "@/components/seller/thumb";
import { ITEM_STATUS_LABEL, STATUS_TONE, fmtDayTime } from "@/components/seller/format";
import { getSellerOrder } from "@/server/seller/orders";

export const metadata: Metadata = { title: "Order" };

type Params = Promise<{ number: string }>;

export default function SellerOrderPage({ params }: { params: Params }) {
  return (
    <>
      <Suspense fallback={<PageHead title="Order" back={{ href: "/seller/orders", label: "Orders" }} />}>
        {params.then(({ number }) => (
          <PageHead title={`Order ${decodeURIComponent(number)}`} back={{ href: "/seller/orders", label: "Orders" }} sub="Your items in this order, where to ship them and what you earn." />
        ))}
      </Suspense>
      <Suspense fallback={<BodySkeleton rows={[240, 200]} />}>
        <OrderBody params={params} />
      </Suspense>
    </>
  );
}

const STATUS_TEXT: Record<string, string> = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

async function OrderBody({ params }: { params: Params }) {
  const { seller } = await requireSellerPage("/seller/orders");
  const { number } = await params;
  const o = await getSellerOrder(seller.id, decodeURIComponent(number));
  if (!o) notFound();
  const count = (s: string) => o.items.filter((i) => i.status === s).length;
  const commission = o.items.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + i.commissionAmt, 0);

  return (
    <div className="sl-body">
      <div className="sl-grid">
        <section className="sl-card sl-span8" aria-labelledby="items-h">
          <div className="sl-card-h">
            <div>
              <h2 id="items-h">Your items</h2>
              <p>
                Placed {fmtDayTime(o.placedAt)} · {o.payment}
              </p>
            </div>
            <Pill tone={STATUS_TONE[o.stage]}>{ITEM_STATUS_LABEL[o.stage]}</Pill>
          </div>
          <div className="sl-tscroll sl-tstack">
            <table className="sl-table sl-stack">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Qty</th>
                  <th className="r">Price</th>
                  <th className="r">Commission</th>
                  <th className="r">You earn</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td className="sl-x-full">
                      <div className="sl-prod">
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
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className="r num" data-l="Qty">
                      {i.qty}
                    </td>
                    <td className="r num" data-l="Price">
                      {formatINR(i.price)}
                      {i.mrp > i.price ? <span className="sl-sub">MRP {formatINR(i.mrp)}</span> : null}
                    </td>
                    <td className="r num" data-l="Commission">
                      {i.status === "CANCELLED" ? "—" : `−${formatINR(i.commissionAmt)}`}
                      <span className="sl-sub">{i.commissionPct}%</span>
                    </td>
                    <td className="r num" data-l="You earn">
                      <b>{i.status === "CANCELLED" ? "—" : formatINR(i.sellerEarning)}</b>
                    </td>
                    <td>
                      <Pill tone={STATUS_TONE[i.status]}>{ITEM_STATUS_LABEL[i.status]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sl-x-full">Total (your items)</td>
                  <td className="r num">{o.units}</td>
                  <td className="r num">{formatINR(o.itemsTotal)}</td>
                  <td className="r num">−{formatINR(commission)}</td>
                  <td className="r num">{formatINR(o.earning)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="sl-card-foot">
            Earnings are credited to your ledger when the item is <b>delivered</b> and paid out in the next weekly payout.
          </div>
        </section>

        <div className="sl-span4" style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="sl-card" aria-labelledby="act-h">
            <div className="sl-card-h">
              <div>
                <h2 id="act-h">Fulfilment</h2>
                <p>{o.open ? "Next step for your items" : "Nothing left for you to do"}</p>
              </div>
            </div>
            {o.open ? (
              <OrderActions number={o.number} placed={count("PLACED")} confirmed={count("CONFIRMED")} packed={count("PACKED")} showDetails={false} />
            ) : (
              <p className="sl-done">
                <Icon name="check" /> {o.stage === "DELIVERED" ? "Delivered to the shopper" : o.stage === "CANCELLED" ? "Order cancelled" : "Closed"}
              </p>
            )}
            {count("SHIPPED") > 0 && !count("PLACED") && !count("CONFIRMED") && !count("PACKED") ? (
              <p className="sl-muted" style={{ fontSize: 13, marginTop: 10 }}>
                In transit with the courier. Delivery is confirmed by the courier / The Big Brands.
              </p>
            ) : null}
          </section>

          <section className="sl-card" aria-labelledby="ship-h">
            <div className="sl-card-h">
              <div>
                <h2 id="ship-h">Ship to</h2>
                <p>{o.open ? "Use exactly this address on the label" : "Delivery area"}</p>
              </div>
            </div>
            <address className="sl-shipto" style={{ fontStyle: "normal", fontSize: 13.5 }}>
              <b>{o.shipTo.name}</b>
              {o.shipTo.line1 ? (
                <>
                  {o.shipTo.line1}
                  <br />
                  {o.shipTo.line2 ? (
                    <>
                      {o.shipTo.line2}
                      <br />
                    </>
                  ) : null}
                  {o.shipTo.landmark ? (
                    <>
                      Near {o.shipTo.landmark}
                      <br />
                    </>
                  ) : null}
                </>
              ) : null}
              {o.shipTo.city}, {o.shipTo.state} {o.shipTo.pincode}
              {o.shipTo.phone ? (
                <>
                  <br />
                  <Icon name="phone" /> +91 {o.shipTo.phone}
                </>
              ) : null}
            </address>
            {!o.open ? <p className="sl-muted" style={{ fontSize: 12, marginTop: 8 }}>The full address and phone number are hidden once fulfilment is complete, to protect the shopper’s privacy.</p> : null}
          </section>

          <section className="sl-card" aria-labelledby="tl-h">
            <div className="sl-card-h">
              <div>
                <h2 id="tl-h">Timeline</h2>
              </div>
            </div>
            {o.timeline.length ? (
              <ol className="sl-tl">
                {o.timeline.map((t, i) => (
                  <li key={i}>
                    <i aria-hidden="true">
                      <Icon name="check" />
                    </i>
                    <span>
                      <b>{STATUS_TEXT[t.status] ?? t.status}</b>
                      <small>
                        {fmtDayTime(t.at)}
                        {t.note ? ` · ${t.note}` : ""}
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="sl-muted">No events yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
