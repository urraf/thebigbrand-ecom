"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/ui/product-image";
import { useCart } from "./cart-context";

/**
 * "Added to cart" flyout (demo showAdded / `#added`): product, gift-tier progress, subtotal,
 * Go to cart / Checkout. Slides in from the right (bottom sheet on phones), auto-hides after 4.5 s
 * (paused while hovered or focused). Mounted once in the store layout.
 */
export function AddedFlyout() {
  const { cart, lastAdded, addedOpen, dismissAdded } = useCart();
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const line = lastAdded ? (cart?.lines.find((l) => l.productId === lastAdded.productId) ?? null) : null;
  const show = Boolean(addedOpen && line);

  useEffect(() => {
    clearTimeout(timer.current);
    if (show && !hover) timer.current = setTimeout(dismissAdded, 4500);
    return () => clearTimeout(timer.current);
  }, [show, hover, lastAdded, dismissAdded]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissAdded();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, dismissAdded]);

  const sub = cart?.subtotal ?? 0;
  const allow = cart?.giftAllowance ?? 0;
  const next = cart?.nextTier ?? null;
  const count = cart?.count ?? 0;
  const pct = next ? Math.max(4, Math.min(100, Math.round((sub / next.minAmount) * 100))) : 100;

  const announce = show && line ? `Added ${line.product.name} to your cart. Cart subtotal ${formatINR(sub)}.` : "";

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <div
        id="added"
        role="region"
        aria-label="Added to cart"
        className={show ? "show" : undefined}
        inert={!show}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        {line ? (
          <div className="af-in">
            <div className="af-top">
              <span className="ok">
                <Icon name="check" />
              </span>
              <b>Added to cart</b>
              <button type="button" className="ib-sm" onClick={dismissAdded} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <div className="af-item">
              <ProductImage product={line.product} className="af-art" sizes="56px" decorative />
              <div>
                <b>{line.product.name}</b>
                <small>
                  {formatINR(line.product.price)}
                  {line.product.size ? ` · ${line.product.size}` : ""}
                  {line.qty > 1 ? ` · Qty ${line.qty}` : ""}
                </small>
              </div>
            </div>
            <div className="af-gift">
              <Icon name="gift" />
              <span>
                You’ve unlocked{" "}
                <b>
                  {allow} free gift{allow === 1 ? "" : "s"}
                </b>
                {next ? ` · add ${formatINR(next.minAmount - sub)} more for ${next.giftCount}` : " — the maximum!"}
                {next ? (
                  <span className="af-meter" style={{ "--p": `${pct}%` } as CSSProperties} aria-hidden="true">
                    <i />
                  </span>
                ) : null}
              </span>
            </div>
            <div className="af-sub">
              <span>
                Cart subtotal ({count} item{count === 1 ? "" : "s"})
              </span>
              <b>{formatINR(sub)}</b>
            </div>
            <div className="af-btns">
              <Link href="/cart" className="btn btn-ghost" onClick={dismissAdded}>
                Go to cart
              </Link>
              <Link href="/checkout" className="btn btn-cart" onClick={dismissAdded}>
                Checkout
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
