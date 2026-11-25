import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { site } from "@/lib/site";
import { BodySkeleton, PageHead } from "@/components/seller/page-head";
import { PrintButton } from "@/components/seller/print-button";
import { fmtDate } from "@/components/seller/format";
import { getSellerOrder } from "@/server/seller/orders";

export const metadata: Metadata = { title: "Packing slip" };

type Params = Promise<{ number: string }>;

export default function PackingSlipPage({ params }: { params: Params }) {
  return (
    <>
      <PageHead title="Packing slip" back={{ href: "/seller/orders", label: "Orders" }} sub="Print on A4 or A5 and place it inside the parcel." actions={<PrintButton />} />
      <Suspense fallback={<BodySkeleton rows={[520]} />}>
        <Slip params={params} />
      </Suspense>
    </>
  );
}

async function Slip({ params }: { params: Params }) {
  const { seller } = await requireSellerPage("/seller/orders");
  const { number } = await params;
  const o = await getSellerOrder(seller.id, decodeURIComponent(number));
  if (!o) notFound();
  const items = o.items.filter((i) => i.status !== "CANCELLED");

  return (
    <div className="sl-body">
      {!o.open ? (
        <div className="sl-note sl-note-warn sl-noprint">
          <b>Fulfilment for this order is complete.</b>&nbsp;The shopper’s full address is hidden; reprints show the delivery area only.
        </div>
      ) : null}
      <article className="sl-card sl-slip">
        <header className="sl-slip-h">
          <div>
            <span className="logo-mark">
              <i aria-hidden="true">tbb</i>
            </span>
            <b>{site.name}</b>
            <small>Packing slip · {site.domain}</small>
          </div>
          <div className="sl-slip-no">
            <small>Order</small>
            <b>{o.number}</b>
            <small>{fmtDate(o.placedAt)} · {o.payment}</small>
          </div>
        </header>
        <div className="sl-slip-addr">
          <section>
            <h3>Ship to</h3>
            <p>
              <b>{o.shipTo.name}</b>
              {o.shipTo.line1 ? (
                <>
                  <br />
                  {o.shipTo.line1}
                  {o.shipTo.line2 ? (
                    <>
                      <br />
                      {o.shipTo.line2}
                    </>
                  ) : null}
                  {o.shipTo.landmark ? (
                    <>
                      <br />
                      Near {o.shipTo.landmark}
                    </>
                  ) : null}
                </>
              ) : null}
              <br />
              {o.shipTo.city}, {o.shipTo.state} – {o.shipTo.pincode}
              {o.shipTo.phone ? (
                <>
                  <br />
                  Phone: +91 {o.shipTo.phone}
                </>
              ) : null}
            </p>
          </section>
          <section>
            <h3>Sold &amp; shipped by</h3>
            <p>
              <b>{seller.businessName}</b>
              <br />
              {seller.addressLine}
              <br />
              {seller.city}, {seller.state} – {seller.pincode}
              {seller.gstin ? (
                <>
                  <br />
                  GSTIN: {seller.gstin}
                </>
              ) : null}
            </p>
          </section>
        </div>
        <table className="sl-table sl-slip-t">
          <thead>
            <tr>
              <th style={{ width: 36 }}>✓</th>
              <th>Item</th>
              <th>SKU</th>
              <th className="r">Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <span className="sl-slip-box" aria-hidden="true" />
                </td>
                <td>
                  <b>{i.name}</b>
                  <span className="sl-sub">
                    {i.brandName}
                    {i.size ? ` · ${i.size}` : ""}
                  </span>
                </td>
                <td className="num">{i.sku ?? "—"}</td>
                <td className="r num">
                  <b>{i.qty}</b>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td>Total units</td>
              <td />
              <td className="r num">{items.reduce((s, i) => s + i.qty, 0)}</td>
            </tr>
          </tfoot>
        </table>
        <footer className="sl-slip-f">
          <p>
            Thank you for shopping on {site.name}! Every product is 100% authentic, sourced from the brand or its authorised distributor. Need help?{" "}
            {site.supportEmail} · {site.supportPhone}
          </p>
          {o.payment === "Cash on delivery" ? <p className="sl-slip-cod">CASH ON DELIVERY — the courier collects payment at the door.</p> : null}
        </footer>
      </article>
    </div>
  );
}
