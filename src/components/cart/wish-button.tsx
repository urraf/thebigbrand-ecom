"use client";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { useStore } from "./cart-context";

/** Wishlist heart (demo `.pc-wish`). Signed-out shoppers get a toast with a Sign in link. */
export function WishButton({ productId, productName, className = "pc-wish" }: { productId: string; productName?: string; className?: string }) {
  const { isWished, toggleWish } = useStore();
  const on = isWished(productId);
  const what = productName ? ` ${productName}` : "";
  return (
    <button
      type="button"
      className={cx(className, on && "on")}
      aria-pressed={on}
      aria-label={on ? `Remove${what} from wishlist` : `Save${what} to wishlist`}
      onClick={(e) => {
        e.preventDefault();
        void toggleWish(productId);
      }}
    >
      <Icon name="heart" />
    </button>
  );
}
