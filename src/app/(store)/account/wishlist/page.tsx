import Link from "next/link";
import { Suspense } from "react";
import { requireUserPage } from "@/lib/auth";
import { Icon } from "@/components/ui/icon";
import { ProductCard } from "@/components/ui/product-card";
import { getWishlist } from "@/server/cart/wishlist";
import { AccSkeleton } from "@/components/commerce/account/skeleton";

export const metadata = { title: "Wishlist" };

/** /account/wishlist — saved products (store-kit wishlist; the heart on each card removes it). */
export default function WishlistPage() {
  return (
    <Suspense fallback={<AccSkeleton />}>
      <Wishlist />
    </Suspense>
  );
}

async function Wishlist() {
  const auth = await requireUserPage("/account/wishlist");
  const { items } = await getWishlist(auth.user.id);
  return (
    <section className="blk cm-acc-sec">
      <div className="co-sec-h">
        <div>
          <h1 className="cm-h1">Your wishlist</h1>
          <p>{items.length ? `${items.length} saved product${items.length === 1 ? "" : "s"} — prices update live.` : "Tap the heart on any product to save it here."}</p>
        </div>
      </div>
      {items.length ? (
        <div className="cm-wish-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} compact sizes="(max-width: 600px) 45vw, 220px" />
          ))}
        </div>
      ) : (
        <div className="cm-empty">
          <Icon name="heart" />
          <p>
            <b>Nothing saved yet</b>
            Save products you love and come back to them anytime.
          </p>
          <Link className="btn btn-cart" href="/">
            Discover products
          </Link>
        </div>
      )}
    </section>
  );
}
