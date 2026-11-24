import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { CartBadgeFallback, ServerCartBadge } from "./session-slots";

/** Mobile bottom tab bar (demo tabbar()): Home, Categories (drawer), Deals, Free gifts, Cart. */
export function TabBar() {
  return (
    <>
      <Link href="/" data-nav="/">
        <Icon name="home" />
        <span>Home</span>
      </Link>
      <button type="button" data-chrome="menu-open" aria-controls="menu" aria-expanded="false">
        <Icon name="grid" />
        <span>Categories</span>
      </button>
      <Link href="/deals" data-nav="/deals">
        <Icon name="zap" />
        <span>Deals</span>
      </Link>
      <Link href="/gifts" data-nav="/gifts">
        <Icon name="gift" />
        <span>Free gifts</span>
      </Link>
      <Link href="/cart" data-nav="/cart" className="tb-cart" prefetch={false}>
        <Icon name="cart" />
        <Suspense fallback={<CartBadgeFallback />}>
          <ServerCartBadge />
        </Suspense>
        <span aria-hidden="true">Cart</span>
      </Link>
    </>
  );
}
