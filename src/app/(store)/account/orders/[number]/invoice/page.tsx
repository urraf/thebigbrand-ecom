import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUserPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { site } from "@/lib/site";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/store/logo";
import { getOrderDetail } from "@/server/orders/customer";
import { ChromeOffLive } from "@/components/commerce/chrome-off-live";
import { AccSkeleton } from "@/components/commerce/account/skeleton";
import { paymentSummary } from "@/components/commerce/order/order-parts";
import { PrintButton } from "@/components/commerce/order/order-actions";

export const metadata = { title: "Invoice" };

/** /account/orders/:number/invoice — printable tax invoice / order summary (owner only). */
export default function InvoicePage({ params }: PageProps<"/account/orders/[number]/invoice">) {
  return (
    <>
      <ChromeOffLive />
      <Suspense fallback={<AccSkeleton />}>
        <Invoice params={params} />
      </Suspense>
    </>
  );
}

const d = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

async function Invoice({ params }: { params: PageProps<"/account/orders/[number]/invoice">["params"] }) {
  const { number } = await params;
  const auth = await requireUserPage(`/account/orders/${number}/invoice`);
  if (!/^[A-Z0-9]{6,24}$/i.test(number)) notFound();
  const o = await getOrderDetail(auth.user.id, number);
  if (!o || o.status === "PENDING_PAYMENT") notFound();
  const a = o.address;
  const pay = paymentSummary(o);
  return (
    <div className="cm-inv-wrap">
      <div className="cm-inv-bar">
        <Link className="btn btn-ghost" href={`/account/orders/${o.number}`}>
          <Icon name="chevLeft" /> Back to order
        </Link>
        <PrintButton />
      </div>
      <article className="cm-inv">
        <header className="cm-inv-h">
          <LogoMark />
          <div>
            <h1>Tax invoice</h1>
            <p>
              Invoice <b>INV-{o.number}</b>
              <br />
              Order <b>#{o.number}</b> · {d(o.placedAt ?? o.createdAt)}
            </p>
          </div>
        </header>
        <div className="cm-inv-cols">
          <div>
            <h2>Sold via</h2>
            <p>
              <b>{site.name}</b> (Shriram Ventures)
              <br />
              {site.supportEmail} · {site.supportPhone}
            </p>
          </div>
          <div>
            <h2>Ship to</h2>
            <p>
              <b>{a.name}</b>
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              +91 {a.phone}
            </p>
          </div>
          <div>
            <h2>Payment</h2>
            <p>
              <b>{pay.label}</b>
              <br />
              {pay.sub}
            </p>
          </div>
        </div>
        <table className="cm-inv-t">
          <thead>
            <tr>
              <th>Item</th>
              <th>Sold by</th>
              <th className="r">Qty</th>
              <th className="r">M.R.P.</th>
              <th className="r">Price</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className={i.status === "CANCELLED" ? "is-x" : undefined}>
                <td>
                  <b>{i.name}</b>
                  <small>
                    {i.brandName}
                    {i.size ? ` · ${i.size}` : ""}
                    {i.status === "CANCELLED" ? " · cancelled" : i.status === "RETURNED" ? " · returned" : ""}
                  </small>
                </td>
                <td>{i.sellerName}</td>
                <td className="r">{i.qty}</td>
                <td className="r">{formatINR(i.mrp)}</td>
                <td className="r">{formatINR(i.price)}</td>
                <td className="r">{formatINR(i.lineTotal)}</td>
              </tr>
            ))}
            {o.gifts.map((g) => (
              <tr key={g.id}>
                <td>
                  <b>{g.name}</b>
                  <small>TBB Originals · {g.miniSize} · complimentary gift</small>
                </td>
                <td>The Big Brands Retail</td>
                <td className="r">1</td>
                <td className="r">{formatINR(g.worth)}</td>
                <td className="r">₹0</td>
                <td className="r">₹0</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="cm-inv-sum">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatINR(o.subtotal)}</dd>
          </div>
          {o.discount ? (
            <div>
              <dt>Coupon {o.couponCode}</dt>
              <dd>−{formatINR(o.discount)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Delivery</dt>
            <dd>{o.shippingFee ? formatINR(o.shippingFee) : "FREE"}</dd>
          </div>
          {o.codFee ? (
            <div>
              <dt>COD fee</dt>
              <dd>{formatINR(o.codFee)}</dd>
            </div>
          ) : null}
          <div className="is-total">
            <dt>Total</dt>
            <dd>{formatINR(o.total)}</dd>
          </div>
        </dl>
        <p className="cm-inv-note">All prices are inclusive of applicable GST. Free gifts carry no charge and are not exchangeable for cash. This is a computer-generated document and needs no signature.</p>
      </article>
    </div>
  );
}
