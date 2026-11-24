"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useCart } from "./cart-context";

type Props = {
  productId: string;
  qty?: number;
  className?: string;
  label?: ReactNode;
  disabled?: boolean;
  /** label when disabled because the product is out of stock */
  soldOutLabel?: string;
  outOfStock?: boolean;
  /** called after a successful add (e.g. to close a quick-view) */
  onAdded?: () => void;
  /** screen-reader context so a grid of identical buttons reads "Add to cart: Lakmé Kajal" */
  productName?: string;
};

/**
 * "Add to cart" — POSTs through useCart() (optimistic header count + Added-to-cart flyout). Shows
 * Adding… → ✓ Added feedback. Errors (stock, limits) are toasted by the cart provider.
 */
export function AddToCartButton({
  productId,
  qty = 1,
  className = "btn btn-cart",
  label = "Add to cart",
  disabled,
  outOfStock,
  soldOutLabel = "Out of stock",
  onAdded,
  productName,
}: Props) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    if (state === "adding") return;
    setState("adding");
    const ok = await addItem(productId, qty);
    setState(ok ? "added" : "idle");
    if (ok) {
      onAdded?.();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 1800);
    }
  };

  const ctx = productName ? <span className="sr-only">: {productName}</span> : null;

  if (outOfStock) {
    return (
      <button type="button" className={`${className} is-soldout`} disabled>
        {soldOutLabel}
        {ctx}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={state === "added" ? `${className} is-added` : className}
      onClick={onClick}
      disabled={disabled}
      aria-busy={state === "adding"}
      data-state={state}
    >
      {state === "adding" ? (
        "Adding…"
      ) : state === "added" ? (
        <>
          <Icon name="check" /> Added
        </>
      ) : (
        label
      )}
      {ctx}
    </button>
  );
}
