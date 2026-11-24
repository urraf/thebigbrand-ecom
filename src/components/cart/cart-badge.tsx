"use client";
import { useCart } from "./cart-context";

/**
 * Cart count pill (`.cart-n`). `initialCount` is the server-rendered count (streamed inside <Suspense>), so
 * the number is right in the HTML before hydration; afterwards the live client count takes over.
 */
export function CartBadge({ initialCount = null }: { initialCount?: number | null }) {
  const { count, ready } = useCart();
  const n = ready ? count : (initialCount ?? null);
  return (
    <span className={n ? "cart-n" : "cart-n zero"} data-count="cart" aria-hidden="true">
      {n ?? ""}
    </span>
  );
}

/** Screen-reader text for cart links: "Cart, 3 items". */
export function CartLabel({ initialCount = null }: { initialCount?: number | null }) {
  const { count, ready } = useCart();
  const n = ready ? count : initialCount;
  return <span className="sr-only">{n == null ? "Cart" : `Cart, ${n} item${n === 1 ? "" : "s"}`}</span>;
}
