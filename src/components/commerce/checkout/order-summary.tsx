"use client";
import Link from "next/link";
import { formatINR } from "@/lib/money";
import type { CartView, GiftOption } from "@/types/shared";
import type { Quote } from "@/server/checkout/types";
import { Icon } from "@/components/ui/icon";
import { plural } from "../api";
import { Art } from "../parts";

export type SummaryTotals = { total: number; codFee: number; saved: number };

export function summaryTotals(quote: Quote, giftWorth: number, cod: boolean): SummaryTotals {
  const codFee = cod && quote.codEnabled ? quote.codFee : 0;
  return { total: quote.total + codFee, codFee, saved: quote.productDiscount + quote.couponDiscount + giftWorth };
}

/** Checkout sidebar: items, chosen gifts at ₹0 (worth struck through), coupon, delivery, COD fee, total, savings. */
export function OrderSummary({
  cart,
  quote,
  gifts,
  selected,
  cod,
  cta,
  coupon,
}: {
  cart: CartView;
  quote: Quote;
  gifts: GiftOption[];
  selected: string[];
  cod: boolean;
  cta?: React.ReactNode;
  coupon?: React.ReactNode;
}) {
  const byId = new Map(gifts.map((g) => [g.id, g]));
  const picked = selected.map((id) => byId.get(id)).filter((g): g is GiftOption => Boolean(g));
  const gw = picked.reduce((a, g) => a + g.worth, 0);
  const t = summaryTotals(quote, gw, cod);
  return (
    <>
      <div className="co-os-h">
        <h2>Order summary</h2>
        <Link className="link" href="/cart">
          Edit cart
        </Link>
      </div>
      <ul className="co-os-items">
        {cart.lines.map((l) => (
          <li key={l.productId} className="co-os-it">
            <Art product={l.product} className="co-os-art" sizes="50px">
              {l.qty > 1 ? <i>{l.qty}</i> : null}
            </Art>
            <span className="co-os-n">
              <b>{l.product.name}</b>
              <small>
                {l.product.brand.name}
                {l.product.size ? ` · ${l.product.size}` : ""}
                {l.qty > 1 ? ` · Qty ${l.qty}` : ""}
              </small>
            </span>
            <span className="co-os-p">{formatINR(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <div className="co-os-gifts">
        <p className="co-os-gh">
          <Icon name="gift" />
          <b>Your free gifts</b>
          <small>TBB Originals</small>
        </p>
        <ul>
          {picked.length ? (
            picked.map((g) => (
              <li key={g.id} className="co-os-it is-gift">
                <Art product={g.product} className="co-os-art" sizes="40px" />
                <span className="co-os-n">
                  <b>{g.miniName}</b>
                  <small>
                    {g.miniSize} · <span className="free">FREE</span>
                  </small>
                </span>
                <span className="co-os-p">
                  <s>{formatINR(g.worth)}</s>₹0
                </span>
              </li>
            ))
          ) : (
            <li className="co-os-gempty">
              <Icon name="gift" />
              <span>Choose {plural(quote.giftAllowance, "free gift")} in step 2</span>
            </li>
          )}
        </ul>
      </div>
      <dl className="co-rows">
        <div>
          <dt>Items ({cart.count}) at M.R.P.</dt>
          <dd>{formatINR(quote.mrpTotal)}</dd>
        </div>
        {quote.productDiscount > 0 ? (
          <div className="is-save">
            <dt>Discount on M.R.P.</dt>
            <dd>−{formatINR(quote.productDiscount)}</dd>
          </div>
        ) : null}
        {quote.coupon ? (
          <div className="is-save">
            <dt>
              <Icon name="tag" />
              Coupon {quote.coupon.code}
            </dt>
            <dd>−{formatINR(quote.couponDiscount)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Delivery</dt>
          <dd>
            {quote.shippingFee ? (
              formatINR(quote.shippingFee)
            ) : (
              <>
                <s>{formatINR(quote.standardShippingFee)}</s> <span className="free">FREE</span>
              </>
            )}
          </dd>
        </div>
        {t.codFee ? (
          <div>
            <dt>Cash on delivery fee</dt>
            <dd>{formatINR(t.codFee)}</dd>
          </div>
        ) : null}
        <div className="is-gift">
          <dt>Free gifts{picked.length ? ` (${picked.length})` : ""}</dt>
          <dd>
            {gw ? <s>{formatINR(gw)}</s> : null} <span className="free">₹0</span>
          </dd>
        </div>
      </dl>
      <div className="co-sum-total">
        <span>Order total</span>
        <b>{formatINR(t.total)}</b>
      </div>
      {t.saved > 0 ? (
        <p className="co-sum-save">
          <Icon name="sparkle" />
          <span>
            You save <b>{formatINR(t.saved)}</b> on this order
            {gw ? ` — ${formatINR(quote.productDiscount + quote.couponDiscount)} off + ${formatINR(gw)} in free gifts` : ""}
          </span>
        </p>
      ) : null}
      {coupon}
      {cta}
    </>
  );
}
