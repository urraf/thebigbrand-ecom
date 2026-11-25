"use client";
import Link from "next/link";
import { useState } from "react";
import type { GiftTierLite, ProductCardData } from "@/types/shared";
import { useCart } from "@/components/cart/cart-context";
import { DeliveryDate } from "@/components/ui/delivery-date";
import { Icon } from "@/components/ui/icon";
import { Stars } from "@/components/ui/stars";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/toast";
import { formatINR } from "@/lib/money";
import { Art, tintVar } from "@/components/catalog/visual";

const brandName = (p: ProductCardData) => (p.brand.isOwn ? "TBB Originals" : p.brand.name);

/** Frequently bought together: this item + 2 picks, tick/untick, live bundle total + gifts, add all to cart. */
export function FrequentlyBought({ items, tiers }: { items: ProductCardData[]; tiers: GiftTierLite[] }) {
  const { addItem } = useCart();
  const [on, setOn] = useState(() => items.map((p) => p.stock > 0));
  const [busy, setBusy] = useState(false);
  const sel = items.filter((_, i) => on[i]);
  const total = sel.reduce((a, x) => a + x.price, 0);
  const mrp = sel.reduce((a, x) => a + x.mrp, 0);
  const gifts = tiers.reduce((n, t) => (total >= t.minAmount ? Math.max(n, t.giftCount) : n), 0);
  const label = sel.length === 3 ? "Add all 3 to cart" : sel.length === 2 ? "Add both to cart" : sel.length === 1 ? "Add to cart" : "Select an item";

  const addAll = async () => {
    if (busy || !sel.length) return;
    setBusy(true);
    let n = 0;
    for (const p of sel) if (await addItem(p.id, 1)) n++;
    setBusy(false);
    if (n > 1) toast(`${n} items added to your cart`, { icon: "check", action: { href: "/cart", label: "View cart" } });
  };

  return (
    <section className="pd-fbt blk" aria-labelledby="pd-fbt-h">
      <div className="pd-sec-h">
        <div className="pd-sec-t">
          <h2 id="pd-fbt-h">Frequently bought together</h2>
          <span className="pd-sec-sub">Customers who bought this also added these</span>
        </div>
      </div>
      <div className="pd-fbt-grid">
        <div className="pd-fbt-items" role="list">
          {items.map((x, i) => (
            <div role="listitem" key={x.id} className={cx("pd-fbt-it", !on[i] && "off")}>
              <Link className="pd-fbt-img" href={`/p/${x.slug}`} style={tintVar(x)} tabIndex={-1} aria-hidden="true" prefetch={false}>
                <Art product={x} sizes="(max-width: 600px) 88px, 240px" />
              </Link>
              <input
                type="checkbox"
                className="pd-fbt-cb"
                checked={on[i]}
                disabled={x.stock <= 0}
                onChange={() => setOn((s) => s.map((v, k) => (k === i ? !v : v)))}
                aria-label={`Include ${brandName(x)} ${x.name} in this bundle`}
              />
              <div className="pd-fbt-meta">
                <span className="pd-fbt-br">
                  {i === 0 ? <em className="pd-fbt-this">This item</em> : null}
                  {brandName(x)}
                </span>
                {i === 0 ? (
                  <span className="pd-fbt-nm">
                    {x.name}
                    {x.size ? `, ${x.size}` : ""}
                  </span>
                ) : (
                  <Link className="pd-fbt-nm" href={`/p/${x.slug}`} prefetch={false}>
                    {x.name}
                    {x.size ? `, ${x.size}` : ""}
                  </Link>
                )}
                {x.reviewCount ? (
                  <span className="pd-fbt-rt">
                    <Stars rating={x.rating} />
                    <small>{x.reviewCount.toLocaleString("en-IN")}</small>
                  </span>
                ) : null}
                <span className="pd-fbt-pr">
                  <b>{formatINR(x.price)}</b>
                  {x.mrp > x.price ? <s>{formatINR(x.mrp)}</s> : null}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="pd-fbt-sum">
          <span className="pd-fbt-lbl">
            Bundle total · {sel.length} item{sel.length === 1 ? "" : "s"}
          </span>
          <p className="pd-fbt-tp">
            <b className="pd-fbt-total">{formatINR(total)}</b>
            {mrp > total ? <s className="pd-fbt-mrp">{formatINR(mrp)}</s> : null}
          </p>
          {mrp > total ? <p className="pd-fbt-save">You save {formatINR(mrp - total)} on M.R.P.</p> : null}
          <div className="pd-fbt-stack" aria-hidden="true">
            {items.map((x, i) =>
              on[i] ? (
                <span key={x.id} className="pd-fbt-dot" style={tintVar(x)}>
                  <Art product={x} sizes="40px" />
                </span>
              ) : null,
            )}
            <span className="pd-fbt-dot pd-fbt-dot-g">
              <Icon name="gift" />
            </span>
            <small>in your box</small>
          </div>
          <p className="pd-fbt-gift">
            <Icon name="gift" />
            <span>
              {total > 0 ? (
                <>
                  Unlocks <b>{gifts} free gift{gifts === 1 ? "" : "s"}</b> at checkout
                </>
              ) : (
                "Pick items to see your gifts"
              )}
            </span>
          </p>
          <button type="button" className="btn btn-cart btn-lg pd-fbt-add" onClick={addAll} disabled={!sel.length || busy} aria-busy={busy || undefined}>
            {busy ? "Adding…" : label}
          </button>
          <small className="pd-fbt-foot">
            <Icon name="truck" />
            {total >= 499 ? "FREE delivery" : "Delivery"} <DeliveryDate days={2} />
          </small>
        </div>
      </div>
    </section>
  );
}
