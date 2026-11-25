import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { getOrderDetail } from "@/server/admin/core/orders";
import { getSettings } from "@/server/admin/core/settings";
import { PrintButton } from "@/components/admin/core/print-button";
import { PAYMENT_LABEL } from "@/components/admin/core/bits";
import { SkeletonTable, fmtDate } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Invoice" };

async function Invoice({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  await requireAdminPage(`/admin/orders/${number}/invoice`);
  const [o, settings] = await Promise.all([getOrderDetail(decodeURIComponent(number)), getSettings()]);
  if (!o) notFound();
  const s = settings.store;
  const lines = o.items.filter((i) => i.status !== "CANCELLED");
  const cancelled = o.items.filter((i) => i.status === "CANCELLED");
  const sellers = [...new Set(lines.map((i) => i.seller?.displayName ?? s.legalName))];
  const cancelledSum = cancelled.reduce((t, i) => t + i.lineTotal, 0);
  const subtotal = o.items.reduce((t, i) => t + i.lineTotal, 0);

  return (
    <div className="inv-page">
      <div className="inv-bar">
        <Link className="btn btn-ghost btn-sm" href={`/admin/orders/${o.number}`}>
          <Icon name="chevLeft" />
          Back to order
        </Link>
        <PrintButton />
      </div>
      <article className="inv" aria-label={`Tax invoice for order ${o.number}`}>
        <header className="inv-h">
          <div>
            <span className="logo-mark">
              <i aria-hidden="true">tbb</i>
            </span>
            <div className="inv-from">
              <b>{s.legalName}</b>
              <span>trading as {s.name}</span>
              {s.address ? <span>{s.address}</span> : null}
              {s.gstin ? <span>GSTIN {s.gstin}</span> : null}
              <span>
                {s.supportEmail} · {s.supportPhone}
              </span>
            </div>
          </div>
          <div className="inv-meta">
            <h1>Tax invoice</h1>
            <dl>
              <div>
                <dt>Invoice no.</dt>
                <dd>
                  {s.invoicePrefix || "TBB"}/{o.number.replace(/^TBB/, "")}
                </dd>
              </div>
              <div>
                <dt>Order no.</dt>
                <dd>{o.number}</dd>
              </div>
              <div>
                <dt>Order date</dt>
                <dd>{fmtDate(o.placedAt ?? o.createdAt)}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>
                  {PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod} · {o.paymentStatus === "PAID" ? "Paid" : o.paymentStatus === "COD_PENDING" ? "To be collected" : o.paymentStatus.toLowerCase()}
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="inv-parties">
          <div>
            <small>Bill &amp; ship to</small>
            <b>{o.address.name}</b>
            <span>{o.address.line1}</span>
            {o.address.line2 ? <span>{o.address.line2}</span> : null}
            <span>
              {o.address.city}, {o.address.state} {o.address.pincode}
            </span>
            <span>+91 {o.address.phone}</span>
          </div>
          <div>
            <small>Sold by</small>
            {sellers.map((n) => (
              <b key={n}>{n}</b>
            ))}
            <span>Place of supply: {o.address.state}</span>
          </div>
        </section>

        <table className="inv-t">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th className="r">MRP</th>
              <th className="r">Price</th>
              <th className="r">Qty</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((i, k) => (
              <tr key={i.id}>
                <td>{k + 1}</td>
                <td>
                  <b>
                    {i.brandName} {i.name}
                  </b>
                  <small>
                    {i.size ? `${i.size} · ` : ""}
                    {i.sku ? `SKU ${i.sku} · ` : ""}Sold by {i.seller?.displayName ?? s.name}
                  </small>
                </td>
                <td className="r">{formatINR(i.mrp)}</td>
                <td className="r">{formatINR(i.price)}</td>
                <td className="r">{i.qty}</td>
                <td className="r">{formatINR(i.lineTotal)}</td>
              </tr>
            ))}
            {o.gifts.map((g) => (
              <tr key={g.id} className="inv-gift">
                <td>—</td>
                <td>
                  <b>Free gift · {g.name}</b>
                  <small>
                    {g.miniSize} · worth {formatINR(g.worth)} · not for sale
                  </small>
                </td>
                <td className="r">—</td>
                <td className="r">₹0</td>
                <td className="r">1</td>
                <td className="r">₹0</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-foot">
          <div className="inv-notes">
            <p>All prices are inclusive of GST. This is a computer-generated invoice and needs no signature.</p>
            {cancelled.length ? <p>{cancelled.length} cancelled line{cancelled.length > 1 ? "s are" : " is"} not billed{o.paymentStatus === "PAID" ? " and will be refunded" : ""}.</p> : null}
            <p>Thank you for shopping with {s.name}! Questions? {s.supportEmail}</p>
          </div>
          <dl className="inv-sum">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatINR(subtotal)}</dd>
            </div>
            {cancelledSum ? (
              <div>
                <dt>Cancelled items</dt>
                <dd>−{formatINR(cancelledSum)}</dd>
              </div>
            ) : null}
            {o.discount ? (
              <div>
                <dt>Coupon {o.couponCode}</dt>
                <dd>−{formatINR(o.discount)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Shipping</dt>
              <dd>{o.shippingFee ? formatINR(o.shippingFee) : "Free"}</dd>
            </div>
            {o.codFee ? (
              <div>
                <dt>COD fee</dt>
                <dd>{formatINR(o.codFee)}</dd>
              </div>
            ) : null}
            <div className="inv-total">
              <dt>Total</dt>
              <dd>{formatINR(Math.max(0, o.total - cancelledSum))}</dd>
            </div>
          </dl>
        </div>
      </article>
    </div>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ number: string }> }) {
  return (
    <Suspense fallback={<SkeletonTable rows={8} />}>
      <Invoice params={params} />
    </Suspense>
  );
}
