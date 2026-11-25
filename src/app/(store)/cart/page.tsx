import type { Metadata } from "next";
import { Suspense } from "react";
import { AdZone } from "@/components/ads";
import { ProductCard } from "@/components/ui/product-card";
import { Rail } from "@/components/ui/rail";
import { CartClient } from "@/components/commerce/cart/cart-client";
import { getStoreSession } from "@/server/cart/session";
import { buildQuote } from "@/server/checkout/quote";
import { getStarterPicks } from "@/server/checkout/picks";
import { listOffers } from "@/server/coupons/service";
import { getGiftCatalog } from "@/server/gifts/service";
import "@/styles/commerce/checkout.css";
import "@/styles/commerce/commerce.css";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your cart, apply a coupon and see the free TBB Originals gifts your order unlocks.",
  robots: { index: false, follow: false },
};

/** /cart — static shell + skeleton; the shopper's cart streams in (session cookie) behind <Suspense>. */
export default function CartPage() {
  return (
    <Suspense fallback={<CartSkeleton />}>
      <CartLoader />
    </Suspense>
  );
}

async function CartLoader() {
  const { user, cart } = await getStoreSession();
  const userId = user?.id ?? null;
  const [quote, catalog, offers] = await Promise.all([buildQuote(cart, userId), getGiftCatalog(), listOffers(cart, userId)]);
  const inCart = [...cart.lines, ...cart.saved].map((l) => l.productId);
  return (
    <CartClient
      initial={{ cart, quote, offers }}
      gifts={catalog.gifts}
      tiers={catalog.tiers}
      c1={<AdZone code="C1" context={{ excludeProductIds: inCart }} cartSubtotal={cart.subtotal} nextGiftAt={cart.nextTier} />}
      starter={<StarterPicks exclude={inCart} />}
    />
  );
}

async function StarterPicks({ exclude }: { exclude: string[] }) {
  const picks = (await getStarterPicks(14)).filter((p) => !exclude.includes(p.id)).slice(0, 10);
  return (
    <>
      <AdZone code="C1" variant="grid" title="Popular picks to start with" subtitle="Brand partner picks — each one comes with a free TBB Originals gift." context={{ excludeProductIds: exclude }} />
      {picks.length ? (
        <section className="blk co-sugg" aria-labelledby="co-best-h">
          <div className="co-sec-h">
            <div>
              <h2 id="co-best-h">Bestsellers to start with</h2>
              <p>Most-loved by shoppers this month — each one comes with a free gift.</p>
            </div>
          </div>
          <Rail label="Bestsellers">
            {picks.map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </Rail>
        </section>
      ) : null}
    </>
  );
}

function CartSkeleton() {
  return (
    <section className="wrap co-page" aria-busy="true" aria-label="Loading your cart">
      <div className="cm-sk cm-sk-meter" />
      <div className="co-cart-grid">
        <div className="co-cart-main">
          <div className="blk co-lines">
            <div className="cm-sk cm-sk-title" />
            {[0, 1].map((i) => (
              <div key={i} className="cm-sk-line">
                <div className="cm-sk cm-sk-art" />
                <div className="cm-sk-txt">
                  <div className="cm-sk cm-sk-l1" />
                  <div className="cm-sk cm-sk-l2" />
                  <div className="cm-sk cm-sk-l3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="co-cart-side">
          <div className="blk co-sum">
            <div className="cm-sk cm-sk-sum" />
          </div>
        </aside>
      </div>
    </section>
  );
}
