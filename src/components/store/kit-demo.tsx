"use client";
import { useCart } from "@/components/cart/cart-context";
import { openMenu } from "./chrome-client";
import { openLocationDialog } from "./location";
import { toast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";

/** Interactive triggers for the /kit showcase (toasts, drawer, dialog, flyout). */
export function KitDemo({ productId }: { productId: string | null }) {
  const { addItem, count, cart, ready } = useCart();
  return (
    <div className="kit-row">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast("Saved to your wishlist", { icon: "heart" })}>
        <Icon name="heart" /> Toast
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => toast("Sign in to save products to your wishlist", { icon: "heart", action: { href: "/login", label: "Sign in" } })}
      >
        <Icon name="user" /> Toast with action
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => openMenu(e.currentTarget)}>
        <Icon name="menu" /> Open All-categories drawer
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openLocationDialog()}>
        <Icon name="pin" /> Deliver-to dialog
      </button>
      {productId ? (
        <button type="button" className="btn btn-cart btn-sm" onClick={() => void addItem(productId)}>
          <Icon name="cart" /> Add → flyout
        </button>
      ) : null}
      <span className="kit-note">
        Cart: {ready ? `${count} item${count === 1 ? "" : "s"} · subtotal ₹${(cart?.subtotal ?? 0).toLocaleString("en-IN")} · ${cart?.giftAllowance ?? 0} gift(s)` : "loading…"}
      </span>
    </div>
  );
}
