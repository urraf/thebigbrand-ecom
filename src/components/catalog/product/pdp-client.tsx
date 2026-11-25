"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const noopSubscribe = () => () => {};
import { useRouter } from "next/navigation";
import type { GiftTierLite, ProductCardData } from "@/types/shared";
import { useCart, useStore } from "@/components/cart/cart-context";
import { openLocationDialog } from "@/components/store/location";
import { DeliveryDate } from "@/components/ui/delivery-date";
import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import { Stars } from "@/components/ui/stars";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/toast";
import { formatINR } from "@/lib/money";
import { Art } from "@/components/catalog/visual";

/**
 * Product page client islands. One small context holds the chosen quantity so the size/pack picker, buy box,
 * mobile sticky bar and desktop quick-buy bar stay in sync. Cart writes go through useCart() (server-priced).
 */

type Pdp = { product: ProductCardData; qty: number; setQty: (n: number) => void; tiers: GiftTierLite[] };
const Ctx = createContext<Pdp | null>(null);
const usePdp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePdp outside PdpProvider");
  return v;
};

export function PdpProvider({ product, tiers, children }: { product: ProductCardData; tiers: GiftTierLite[]; children: ReactNode }) {
  const [qty, setQtyRaw] = useState(1);
  const max = Math.max(1, Math.min(10, product.stock));
  const setQty = (n: number) => setQtyRaw(Math.max(1, Math.min(max, Math.round(n) || 1)));
  return <Ctx value={{ product, qty, setQty, tiers }}>{children}</Ctx>;
}

const giftsFor = (subtotal: number, tiers: GiftTierLite[]) => tiers.reduce((n, t) => (subtotal >= t.minAmount ? Math.max(n, t.giftCount) : n), 0);

function useBuy() {
  const { product, qty } = usePdp();
  const { addItem } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const soldOut = product.stock <= 0;
  const add = async () => {
    if (busy || soldOut) return;
    setBusy("add");
    await addItem(product.id, qty);
    setBusy(null);
  };
  const buy = async () => {
    if (busy || soldOut) return;
    setBusy("buy");
    const ok = await addItem(product.id, qty);
    if (ok) router.push("/checkout");
    else setBusy(null);
  };
  return { add, buy, busy, soldOut };
}

/** Size / pack picker: 1 · 2 · 3 packs (sets the quantity), with the free gifts each unlocks. */
export function PackPicker({ unitPrice }: { unitPrice: string | null }) {
  const { product: p, qty, setQty, tiers } = usePdp();
  const base = giftsFor(p.price, tiers);
  const packs = [1, 2, 3].filter((n) => n <= Math.max(1, Math.min(10, p.stock)));
  return (
    <div className="pd-size">
      <div className="pd-lbl">
        Size: <b className="pd-size-v">{qty > 1 ? `${p.size ?? "Pack"} × ${qty}` : (p.size ?? "Standard")}</b>
      </div>
      <div className="pd-packs" role="group" aria-label="Choose pack size">
        {packs.map((n) => {
          const price = p.price * n;
          const g = giftsFor(price, tiers);
          return (
            <button key={n} type="button" className={cx("pd-pack", qty === n && "on")} aria-pressed={qty === n} onClick={() => setQty(n)}>
              <span className="pd-pack-s">{n === 1 ? (p.size ?? "Single") : `${p.size ?? "Pack"} × ${n}`}</span>
              <b>{formatINR(price)}</b>
              <small>{n === 1 ? unitPrice || " " : `Pack of ${n}`}</small>
              {g > base ? (
                <em>
                  <Icon name="gift" />
                  {g} free gifts
                </em>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "With this in your cart: N free gifts · add ₹X more for M" meter. */
function GiftTier() {
  const { product: p, qty, tiers } = usePdp();
  const { cart } = useCart();
  const inCart = Boolean(cart?.lines.some((l) => l.productId === p.id));
  const sub = (cart?.subtotal ?? 0) + (inCart ? 0 : p.price * qty);
  const n = giftsFor(sub, tiers);
  const next = tiers.filter((t) => t.minAmount > sub).sort((a, b) => a.minAmount - b.minAmount)[0];
  const top = Math.max(1, ...tiers.map((t) => t.minAmount));
  return (
    <div className="pd-tier">
      <div className="pd-tier-bar">
        <i style={{ width: `${Math.max(4, Math.min(100, (sub / top) * 100)).toFixed(1)}%` }} />
        {tiers
          .filter((t) => t.minAmount > 0)
          .map((t) => (
            <span key={t.minAmount} style={{ left: `${((t.minAmount / top) * 100).toFixed(1)}%` }} className={sub >= t.minAmount ? "ok" : ""} title={`${formatINR(t.minAmount)}: ${t.giftCount} gifts`} />
          ))}
      </div>
      <p>
        {inCart ? "Your cart now unlocks" : "With this in your cart:"}{" "}
        <b>
          {n} free gift{n === 1 ? "" : "s"}
        </b>
        {next ? ` · add ${formatINR(next.minAmount - sub)} more for ${next.giftCount}` : " · maximum unlocked"}
      </p>
    </div>
  );
}

export type GiftMiniView = { id: string; name: string; size: string; product: ProductCardData };

/** The buy box: price, delivery, deliver-to, stock, qty, Add to cart / Buy now, free gift box, seller, wishlist. */
export function BuyBox({ gifts, seller, ownLabel }: { gifts: GiftMiniView[]; seller: string; ownLabel: boolean }) {
  const { product: p, qty, setQty } = usePdp();
  const { add, buy, busy, soldOut } = useBuy();
  const { deliverTo, isWished, toggleWish } = useStore();
  const wished = isWished(p.id);
  const maxQty = Math.max(1, Math.min(10, p.stock));
  return (
    <div className="pd-box blk" id="pd-box">
      <div className="pd-box-price">
        <Price price={p.price * qty} mrp={p.mrp * qty} />
      </div>
      {!soldOut ? (
        <p className="pd-del">
          {p.price * qty >= 499 ? (
            <>
              <span className="free">FREE</span> delivery <DeliveryDate days={2} /> on this order.
            </>
          ) : (
            <>
              Delivery <DeliveryDate days={2} /> · <span className="free">FREE</span> over ₹499
            </>
          )}
        </p>
      ) : null}
      <div className="pd-pin">
        <button type="button" className="pd-pin-btn" onClick={() => openLocationDialog()}>
          <Icon name="pin" />
          <span>
            {deliverTo ? (
              <>
                Deliver to {deliverTo.name ? `${deliverTo.name.split(" ")[0]} – ` : ""}
                {deliverTo.city ? `${deliverTo.city} ` : ""}
                <b>{deliverTo.pincode}</b>
              </>
            ) : (
              <>Enter your pincode to check delivery</>
            )}
          </span>
        </button>
      </div>
      {soldOut ? (
        <p className="pd-stock is-out">Currently out of stock</p>
      ) : p.stock <= 5 ? (
        <p className="pd-stock is-low">Only {p.stock} left in stock — order soon</p>
      ) : (
        <p className="pd-stock">
          <Icon name="check" />
          In stock
        </p>
      )}
      {!soldOut ? (
        <div className="pd-qty">
          <label htmlFor="pd-qty">Quantity</label>
          <select id="pd-qty" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {Array.from({ length: maxQty }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button type="button" className="btn btn-cart btn-lg pd-cta" onClick={add} disabled={soldOut} aria-busy={busy === "add" || undefined}>
        <Icon name="cart" />
        {soldOut ? "Out of stock" : busy === "add" ? "Adding…" : "Add to cart"}
      </button>
      {!soldOut ? (
        <button type="button" className="btn btn-buy btn-lg pd-cta pd-buy" onClick={buy} aria-busy={busy === "buy" || undefined}>
          <Icon name="zap" />
          {busy === "buy" ? "Taking you to checkout…" : "Buy now"}
        </button>
      ) : null}
      {gifts.length ? (
        <div className="pd-gift">
          <div className="pd-gift-h">
            <span className="pd-gift-ic">
              <Icon name="gift" />
            </span>
            <div>
              <b>Free gift with this order</b>
              <small>Choose a complimentary TBB Original at checkout — before you pay.</small>
            </div>
          </div>
          <div className="pd-minis">
            {gifts.slice(0, 5).map((g) => (
              <span key={g.id} className="pd-mini" title={`${g.name} · ${g.size}`}>
                <Art product={g.product} sizes="40px" />
              </span>
            ))}
            {gifts.length > 5 ? <span className="pd-mini pd-mini-more">+{gifts.length - 5}</span> : null}
          </div>
          <GiftTier />
        </div>
      ) : null}
      <dl className="pd-seller">
        <div>
          <dt>Ships from</dt>
          <dd>{seller === "The Big Brands Retail" ? "The Big Brands" : seller}</dd>
        </div>
        <div>
          <dt>Sold by</dt>
          <dd>
            {seller} <small>({ownLabel ? "brand owner" : "authorised seller"})</small>
          </dd>
        </div>
        <div>
          <dt>Returns</dt>
          <dd>7-day easy returns</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>
            <Icon name="shield" />
            Secure transaction
          </dd>
        </div>
      </dl>
      <button type="button" className={cx("btn btn-ghost pd-wishbtn", wished && "on")} aria-pressed={wished} onClick={() => void toggleWish(p.id)}>
        <Icon name="heart" />
        <span>{wished ? "Saved to wishlist" : "Add to wishlist"}</span>
      </button>
    </div>
  );
}

/** Mobile sticky buy bar (above the tab bar) + desktop quick-buy bar (slides in once the buy box scrolls away). */
export function QuickBuyBars({ title, rankLabel }: { title: string; rankLabel: string }) {
  const { product: p, qty } = usePdp();
  const { add, buy, busy, soldOut } = useBuy();
  useEffect(() => {
    const cta = document.querySelector(".pd-box .pd-cta");
    if (!cta || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([en]) => document.body.classList.toggle("pd-bar-on", !en.isIntersecting && en.boundingClientRect.top < 0));
    io.observe(cta);
    return () => {
      io.disconnect();
      document.body.classList.remove("pd-bar-on");
    };
  }, []);
  return (
    <>
      <div className="pd-sticky" role="region" aria-label="Quick buy">
        <div className="pd-sticky-p">
          <b>{formatINR(p.price * qty)}</b>
          <small>
            {qty > 1 ? `Qty ${qty} · ` : ""}
            {soldOut ? "Out of stock" : <>Delivery <DeliveryDate days={2} /></>}
          </small>
        </div>
        <button type="button" className="btn btn-cart" onClick={add} disabled={soldOut} aria-busy={busy === "add" || undefined}>
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
        <button type="button" className="btn btn-buy" onClick={buy} disabled={soldOut} aria-busy={busy === "buy" || undefined}>
          Buy now
        </button>
      </div>
      <div className="pd-topbar" role="region" aria-label="Quick buy bar">
        <div className="wrap pd-tb-in">
          <span className="pd-tb-img">
            <Art product={p} sizes="48px" />
          </span>
          <div className="pd-tb-t">
            <b>{title}</b>
            <span>
              {p.reviewCount ? (
                <>
                  <Stars rating={p.rating} />
                  <em>{p.rating.toFixed(1)}</em>
                  <span className="pd-tb-rc">({p.reviewCount.toLocaleString("en-IN")})</span>
                </>
              ) : null}
              {rankLabel ? <span className="pd-tb-rank">{rankLabel}</span> : null}
            </span>
          </div>
          <div className="pd-tb-p">
            <Price price={p.price * qty} mrp={p.mrp * qty} />
            <small>
              {qty > 1 ? `Qty ${qty} · ` : ""}Delivery <DeliveryDate days={2} />
            </small>
          </div>
          <span className="pd-tb-gift">
            <Icon name="gift" />
            <span>
              Free TBB gift<small>picked at checkout</small>
            </span>
          </span>
          <button type="button" className="btn btn-cart" onClick={add} disabled={soldOut}>
            <Icon name="cart" />
            Add to cart
          </button>
          <button type="button" className="btn btn-buy" onClick={buy} disabled={soldOut}>
            Buy now
          </button>
        </div>
      </div>
    </>
  );
}

/** Horizontal offers scroller with arrows + edge fades. */
export function OffersScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    const upd = () => setEdge({ start: t.scrollLeft <= 4, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 4 });
    upd();
    t.addEventListener("scroll", upd, { passive: true });
    const ro = new ResizeObserver(upd);
    ro.observe(t);
    return () => {
      t.removeEventListener("scroll", upd);
      ro.disconnect();
    };
  }, []);
  const go = (d: number) => ref.current?.scrollBy({ left: d * 190, behavior: "smooth" });
  return (
    <div className={cx("pd-offers-wrap", edge.start && "at-start", edge.end && "at-end")}>
      <button type="button" className="pd-oarr prev" aria-label="Previous offers" onClick={() => go(-1)} tabIndex={-1}>
        <Icon name="chevLeft" />
      </button>
      <div className="pd-offers" role="list" ref={ref}>
        {children}
      </div>
      <button type="button" className="pd-oarr next" aria-label="More offers" onClick={() => go(1)} tabIndex={-1}>
        <Icon name="chevRight" />
      </button>
    </div>
  );
}

/** Copy a coupon code to the clipboard. */
export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          toast(`Code ${code} copied — paste it at checkout`, { icon: "tag" });
          setTimeout(() => setDone(false), 2000);
        } catch {
          toast(`Use code ${code} at checkout`, { icon: "tag" });
        }
      }}
    >
      {done ? "Copied ✓" : `Copy code ${code}`}
    </button>
  );
}

/** Clip a sponsored brand coupon (POST /api/v1/ads/coupons/[id]/clip) — applied automatically at checkout. */
export function ClipCoupon({ couponId, label, className = "link" }: { couponId: string; label: string; className?: string }) {
  const { ready, user } = useStore();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!ready || !user) return;
    let live = true;
    fetch("/api/v1/ads/coupons", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { clipped?: string[] | null } } | null) => live && setOn(Boolean(j?.data?.clipped?.includes(couponId))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ready, user, couponId]);
  const signIn = () => {
    const next = location.pathname + location.search;
    toast("Sign in to clip coupons — they apply automatically at checkout", { icon: "scissors", action: { href: `/login?next=${encodeURIComponent(next)}`, label: "Sign in" } });
  };
  const toggle = async () => {
    if (busy) return;
    if (ready && !user) return signIn();
    setBusy(true);
    const want = !on;
    setOn(want);
    try {
      const res = await fetch(`/api/v1/ads/coupons/${encodeURIComponent(couponId)}/clip`, { method: want ? "POST" : "DELETE", credentials: "same-origin" });
      if (res.status === 401) {
        setOn(!want);
        signIn();
      } else if (!res.ok) {
        setOn(!want);
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast(j?.error?.message ?? "Couldn't clip that coupon — please try again", { icon: "info" });
      } else toast(want ? `${label} clipped — applied automatically at checkout` : `${label} removed`, { icon: want ? "scissors" : "info" });
    } catch {
      setOn(!want);
      toast("You're offline — please try again", { icon: "info" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={cx(className, on && "is-on")} aria-pressed={on} onClick={toggle} aria-busy={busy || undefined}>
      {on ? <Icon name="check" /> : <Icon name="scissors" />}
      <span>{on ? "Clipped · applied at checkout" : "Clip coupon"}</span>
    </button>
  );
}

/** Jump to the reviews section. */
export function ReviewsLink({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="pd-rcount"
      onClick={() => {
        const el = document.getElementById("pd-reviews");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        el?.focus({ preventScroll: true });
      }}
    >
      {children}
    </button>
  );
}

/** "Helpful" vote on a review (POST /api/v1/catalog/reviews/[id]/helpful); remembered in this browser. */
export function HelpfulButton({ reviewId, initial }: { reviewId: string; initial: number }) {
  const KEY = "tbb_helpful";
  const [count, setCount] = useState(initial);
  const stored = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).includes(reviewId);
      } catch {
        return false;
      }
    },
    () => false,
  );
  const [justVoted, setVoted] = useState(false);
  const voted = stored || justVoted;
  const vote = async () => {
    if (voted) return;
    setVoted(true);
    setCount((c) => c + 1);
    try {
      const res = await fetch(`/api/v1/catalog/reviews/${encodeURIComponent(reviewId)}/helpful`, { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as { data?: { helpful: number } } | null;
      if (res.ok && j?.data) setCount(j.data.helpful);
      else if (!res.ok) throw new Error();
      try {
        const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
        localStorage.setItem(KEY, JSON.stringify([...list, reviewId].slice(-300)));
      } catch {
        /* storage unavailable */
      }
    } catch {
      setVoted(false);
      setCount((c) => c - 1);
      toast("Couldn't record your vote — please try again", { icon: "info" });
    }
  };
  return (
    <div className="pd-rv-act">
      <span className="pd-rv-h">{count > 0 ? `${count.toLocaleString("en-IN")} ${count === 1 ? "person" : "people"} found this helpful` : "Was this review helpful?"}</span>
      {voted ? (
        <span className="pd-rv-thx">
          <Icon name="check" />
          Thank you for your feedback
        </span>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={vote}>
          Helpful
        </button>
      )}
    </div>
  );
}
