"use client";
/**
 * CART PAGE island — live line items from useCart() (optimistic qty / remove / save for later), the free-gift
 * meter, coupon box and the server-computed totals (GET /api/v1/checkout/quote, refetched whenever the cart
 * changes). Server-rendered slots (C1 sponsored rail, empty-cart picks) are passed in as nodes.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatINR, discountPct } from "@/lib/money";
import type { CartLine, CartView, GiftOption, GiftTierLite } from "@/types/shared";
import type { CouponOffer, Quote } from "@/server/checkout/types";
import { useCart, useStore } from "@/components/cart/cart-context";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import { openLocationDialog } from "@/components/store/location";
import { capi, errMessage, plural } from "../api";
import { Art, EmptyArt, GiftMeter, TrustList, topWorth } from "../parts";
import { CouponBox } from "./coupon-box";

type QuoteResp = { cart: CartView; quote: Quote; offers?: CouponOffer[] };

const sig = (c: CartView) => `${c.lines.map((l) => `${l.productId}:${l.qty}`).join(",")}|${c.couponCode ?? ""}`;
const allowanceFor = (subtotal: number, tiers: GiftTierLite[]) => (subtotal <= 0 ? 0 : tiers.reduce((n, t) => (subtotal >= t.minAmount ? Math.max(n, t.giftCount) : n), 0));

export function CartClient({
  initial,
  gifts,
  tiers,
  c1,
  starter,
}: {
  initial: QuoteResp & { offers: CouponOffer[] };
  gifts: GiftOption[];
  tiers: GiftTierLite[];
  c1: ReactNode;
  starter: ReactNode;
}) {
  const { cart: live, setQty, remove, saveForLater, refresh, busy } = useCart();
  const { deliverTo, user } = useStore();
  const cart = live ?? initial.cart;
  const [quote, setQuote] = useState<Quote>(initial.quote);
  const [offers, setOffers] = useState<CouponOffer[]>(initial.offers);
  const [quotedSig, setQuotedSig] = useState(sig(initial.cart));
  const [pulse, setPulse] = useState(false);
  const [undo, setUndo] = useState<{ line: CartLine } | null>(null);
  const reqId = useRef(0);
  const prevAllow = useRef(allowanceFor(cart.subtotal, tiers));

  const currentSig = sig(cart);
  const stale = currentSig !== quotedSig;

  const loadQuote = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const r = await capi<QuoteResp>("/api/v1/checkout/quote?offers=1");
      if (id !== reqId.current) return;
      setQuote(r.quote);
      setOffers(r.offers ?? []);
      setQuotedSig(sig(r.cart));
    } catch {
      /* keep the last totals; the next change retries */
    }
  }, []);

  // refetch the server totals once the cart settles (no request while an optimistic mutation is in flight)
  useEffect(() => {
    if (!stale || busy) return;
    const t = setTimeout(loadQuote, 120);
    return () => clearTimeout(t);
  }, [stale, busy, currentSig, loadQuote]);

  // celebrate a newly unlocked gift tier
  useEffect(() => {
    const now = allowanceFor(cart.subtotal, tiers);
    if (now > prevAllow.current && prevAllow.current > 0) {
      setPulse(true);
      toast(`You’ve unlocked ${plural(now, "free gift")}! Pick them at checkout`, { icon: "gift" });
      const t = setTimeout(() => setPulse(false), 1600);
      prevAllow.current = now;
      return () => clearTimeout(t);
    }
    prevAllow.current = now;
  }, [cart.subtotal, tiers]);

  const onCoupon = useCallback(
    (r: { cart: CartView; quote: Quote }) => {
      setQuote(r.quote);
      setQuotedSig(sig(r.cart));
      void refresh();
      void capi<{ offers: CouponOffer[] }>("/api/v1/coupons").then((o) => setOffers(o.offers)).catch(() => {});
    },
    [refresh],
  );

  const removeLine = async (line: CartLine) => {
    setUndo({ line });
    await remove(line.productId);
  };

  const undoRemove = async () => {
    if (!undo) return;
    const { line } = undo;
    setUndo(null);
    try {
      await capi("/api/v1/cart", { method: "POST", json: { productId: line.productId, qty: line.qty } });
      await refresh();
    } catch (e) {
      toast(errMessage(e), { icon: "info" });
    }
  };

  // mobile sticky checkout bar: shown once the summary CTA scrolls out of view
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const [barOn, setBarOn] = useState(false);
  const hasLines = cart.lines.length > 0;
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setBarOn(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [hasLines]);

  const allow = allowanceFor(cart.subtotal, tiers);
  const freeMin = quote.freeShippingMin;
  const shipping = cart.subtotal >= freeMin || cart.subtotal <= 0 ? 0 : quote.standardShippingFee;
  const productDiscount = Math.max(0, cart.mrpTotal - cart.subtotal);
  const couponDiscount = stale ? (quote.coupon ? quote.couponDiscount : 0) : quote.couponDiscount;
  const total = stale ? Math.max(0, cart.subtotal - couponDiscount) + shipping : quote.total;
  const worth = topWorth(gifts, allow);

  const checkoutHref = user ? "/checkout" : "/login?next=%2Fcheckout";

  if (!cart.lines.length) {
    return (
      <section className="wrap co-page co-empty">
        <div className="blk co-empty-hero">
          <EmptyArt />
          <div className="co-empty-t">
            <h1>Your cart is empty</h1>
            <p>
              Shop 50+ brands you already love — and every order comes with a <b>free TBB Originals gift</b> you choose before paying. Up to{" "}
              {Math.max(1, ...tiers.map((t) => t.giftCount))} per order.
            </p>
            <div className="co-empty-btns">
              <Link className="btn btn-cart btn-lg" href="/">
                Start shopping <Icon name="arrow" />
              </Link>
              <Link className="btn btn-ghost btn-lg" href="/deals">
                <Icon name="zap" /> Today&rsquo;s deals
              </Link>
            </div>
          </div>
          {gifts.length ? (
            <div className="co-empty-gifts" aria-label="Free gifts you can choose">
              <small>Free with your order</small>
              <div>
                {gifts.slice(0, 6).map((g) => (
                  <Art key={g.id} product={g.product} className="co-mini" sizes="56px" />
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {undo ? <UndoStrip line={undo.line} onUndo={undoRemove} onClose={() => setUndo(null)} /> : null}
        <SavedBlock saved={cart.saved} onMove={(id) => saveForLater(id, false)} onDelete={remove} />
        {starter}
      </section>
    );
  }

  return (
    <section className="wrap co-page co-cart">
      <GiftMeter subtotal={cart.subtotal} tiers={tiers} gifts={gifts} pulse={pulse} />
      <div className={cx("co-cbar", barOn && "is-show")} aria-hidden={!barOn}>
        <div className="co-cbar-t">
          <small>Total · {plural(cart.count, "item")}</small>
          <b>{formatINR(total)}</b>
        </div>
        {allow ? (
          <span className="co-cbar-g">
            <Icon name="gift" />
            {plural(allow, "gift")} free
          </span>
        ) : null}
        <Link className="btn btn-cart" href={checkoutHref} tabIndex={barOn ? 0 : -1}>
          Checkout <Icon name="arrow" />
        </Link>
      </div>
      <div className="co-cart-grid">
        <div className="co-cart-main">
          <div className="blk co-lines">
            <div className="co-lines-h">
              <h1>
                Shopping cart <span>{plural(cart.count, "item")}</span>
              </h1>
              <span className="co-lines-ph" aria-hidden="true">
                Price
              </span>
            </div>
            {undo ? <UndoStrip line={undo.line} onUndo={undoRemove} onClose={() => setUndo(null)} /> : null}
            {cart.lines.map((l) => (
              <LineRow key={l.productId} line={l} onQty={(q) => (q <= 0 ? removeLine(l) : setQty(l.productId, q))} onDelete={() => removeLine(l)} onLater={() => saveForLater(l.productId, true)} />
            ))}
            <p className="co-lines-sub">
              Subtotal ({plural(cart.count, "item")}): <b>{formatINR(cart.subtotal)}</b>
            </p>
          </div>
          <div className="co-c1">{c1}</div>
          <SavedBlock saved={cart.saved} onMove={(id) => saveForLater(id, false)} onDelete={remove} />
        </div>
        <aside className="co-cart-side" aria-label="Order summary">
          <div className={cx("blk co-sum", stale && "is-stale")} aria-busy={stale}>
            {shipping === 0 ? (
              <p className="co-ship is-ok">
                <Icon name="check" />
                <span>
                  Your order qualifies for <b>FREE delivery</b>
                </span>
              </p>
            ) : (
              <p className="co-ship">
                <Icon name="truck" />
                <span>
                  Add <b>{formatINR(freeMin - cart.subtotal)}</b> more for <b>FREE delivery</b>
                </span>
                <i style={{ width: `${Math.min(100, (cart.subtotal / freeMin) * 100).toFixed(1)}%` }} />
              </p>
            )}
            <dl className="co-rows">
              <div>
                <dt>Items ({cart.count}) at M.R.P.</dt>
                <dd>{formatINR(cart.mrpTotal)}</dd>
              </div>
              {productDiscount > 0 ? (
                <div className="is-save">
                  <dt>Savings vs M.R.P.</dt>
                  <dd>−{formatINR(productDiscount)}</dd>
                </div>
              ) : null}
              {quote.coupon ? (
                <div className="is-save">
                  <dt>
                    <Icon name="tag" />
                    Coupon {quote.coupon.code}
                  </dt>
                  <dd>−{formatINR(couponDiscount)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Delivery</dt>
                <dd>
                  {shipping ? (
                    formatINR(shipping)
                  ) : (
                    <>
                      <s>{formatINR(quote.standardShippingFee)}</s> <span className="free">FREE</span>
                    </>
                  )}
                </dd>
              </div>
              <div className="is-gift">
                <dt>
                  <Icon name="gift" />
                  Free gifts × {allow}
                </dt>
                <dd>
                  <span className="free">FREE</span>
                </dd>
              </div>
            </dl>
            <div className="co-sum-total">
              <span>Total</span>
              <b>{formatINR(total)}</b>
            </div>
            {productDiscount + couponDiscount + worth > 0 ? (
              <p className="co-sum-save">
                <Icon name="sparkle" />
                <span>
                  You save <b>{formatINR(productDiscount + couponDiscount + worth)}</b>
                  {worth ? ` — incl. free gifts worth up to ${formatINR(worth)}` : ""}
                </span>
              </p>
            ) : null}
            <CouponBox quote={quote} offers={offers} onChange={onCoupon} />
            <Link ref={ctaRef} className="btn btn-cart btn-lg co-sum-cta" href={checkoutHref}>
              Proceed to checkout <Icon name="arrow" />
            </Link>
            <p className="co-sum-to">
              <Icon name="pin" />
              {deliverTo ? (
                <span>
                  Delivering to {deliverTo.name ? <b>{deliverTo.name}</b> : null}
                  {deliverTo.name ? " · " : ""}
                  {deliverTo.city ? `${deliverTo.city} ` : ""}
                  {deliverTo.pincode}
                </span>
              ) : (
                <span>
                  <button type="button" className="co-tb cm-inline" onClick={() => openLocationDialog()}>
                    Enter your pincode
                  </button>{" "}
                  to check delivery
                </span>
              )}
            </p>
          </div>
          <TrustList />
        </aside>
      </div>
    </section>
  );
}

function LineRow({ line: l, onQty, onDelete, onLater }: { line: CartLine; onQty: (q: number) => void; onDelete: () => void; onLater: () => void }) {
  const p = l.product;
  const off = discountPct(p.mrp, p.price);
  const cap = Math.min(10, p.stock);
  return (
    <article className="co-line">
      <Link className="co-line-art-l" href={`/p/${p.slug}`} tabIndex={-1} aria-hidden="true" prefetch={false}>
        <Art product={p} className="co-line-art" sizes="136px" />
      </Link>
      <div className="co-line-info">
        <Link className="co-line-brand" href={`/brand/${p.brand.slug}`} prefetch={false}>
          {p.brand.name}
        </Link>
        <Link className="co-line-name" href={`/p/${p.slug}`} prefetch={false}>
          {p.name}
        </Link>
        <div className="co-line-meta">
          {p.stock <= 5 ? (
            <span className="co-stock is-low">Only {p.stock} left</span>
          ) : (
            <span className="co-stock">
              <Icon name="check" />
              In stock
            </span>
          )}
          {p.size ? (
            <span>
              Size: <b>{p.size}</b>
            </span>
          ) : null}
          {p.badge || p.isOwnLabel ? <span className="co-line-tag">{p.badge ?? "TBB Original"}</span> : null}
        </div>
        <div className="co-line-del">
          <Icon name="truck" />
          <span>Ships in 24 hours · 7-day easy returns</span>
        </div>
      </div>
      <div className="co-line-price">
        {off ? <span className="co-off">{off}% off</span> : null}
        <b>{formatINR(p.price * l.qty)}</b>
        {off ? (
          <small>
            M.R.P. <s>{formatINR(p.mrp * l.qty)}</s>
          </small>
        ) : null}
        {l.qty > 1 ? <small>{formatINR(p.price)} each</small> : null}
      </div>
      <div className="co-line-acts">
        <div className="co-qty" role="group" aria-label={`Quantity for ${p.name}`}>
          <button type="button" onClick={() => onQty(l.qty - 1)} aria-label={l.qty === 1 ? "Remove item" : "Decrease quantity"}>
            <Icon name={l.qty === 1 ? "trash" : "minus"} />
          </button>
          <output aria-live="polite" aria-label="Quantity">
            {l.qty}
          </output>
          <button type="button" onClick={() => onQty(l.qty + 1)} aria-label="Increase quantity" disabled={l.qty >= cap}>
            <Icon name="plus" />
          </button>
        </div>
        <button type="button" className="co-tb" onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="co-tb" onClick={onLater}>
          Save for later
        </button>
      </div>
    </article>
  );
}

function UndoStrip({ line, onUndo, onClose }: { line: CartLine; onUndo: () => void; onClose: () => void }) {
  return (
    <p className="cm-undo" role="status">
      <Icon name="trash" />
      <span>
        Removed <b>{line.product.name}</b>
      </span>
      <button type="button" className="co-tb" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="cm-x" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" />
      </button>
    </p>
  );
}

function SavedBlock({ saved, onMove, onDelete }: { saved: CartLine[]; onMove: (id: string) => void; onDelete: (id: string) => void }) {
  const items = useMemo(() => saved, [saved]);
  if (!items.length) return null;
  return (
    <section className="blk co-later" aria-label="Saved for later">
      <div className="co-sec-h">
        <div>
          <h2>
            Saved for later <span>({items.length})</span>
          </h2>
          <p>Prices can change — move them back when you&rsquo;re ready.</p>
        </div>
      </div>
      <div className="co-later-grid">
        {items.map((l) => {
          const p = l.product;
          const out = p.stock <= 0;
          return (
            <div key={p.id} className="co-lt">
              <Link href={`/p/${p.slug}`} tabIndex={-1} aria-hidden="true" prefetch={false}>
                <Art product={p} className="co-lt-art" sizes="84px" />
              </Link>
              <div className="co-lt-b">
                <small>{p.brand.name}</small>
                <Link href={`/p/${p.slug}`} prefetch={false}>
                  {p.name}
                </Link>
                <b>{out ? <span className="cm-out">Out of stock</span> : formatINR(p.price)}</b>
                <div className="co-lt-acts">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMove(p.id)} disabled={out}>
                    Move to cart
                  </button>
                  <button type="button" className="co-tb" onClick={() => onDelete(p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
