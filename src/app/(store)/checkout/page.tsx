import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuth } from "@/lib/auth";
import { ChromeOffLive } from "@/components/commerce/chrome-off-live";
import { LogoMark } from "@/components/store/logo";
import { Icon } from "@/components/ui/icon";
import { CheckoutClient } from "@/components/commerce/checkout/checkout-client";
import { EmptyArt, XIcon } from "@/components/commerce/parts";
import { getCheckoutSummary } from "@/server/checkout/summary";
import "@/styles/commerce/checkout.css";
import "@/styles/commerce/commerce.css";

export const metadata: Metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};

/**
 * /checkout — focused, chrome-less 3-step flow (address → free gifts → payment). Requires sign-in
 * (→ /login?next=/checkout). The per-user summary streams in behind <Suspense>.
 */
export default function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  return (
    <>
      <ChromeOffLive />
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CheckoutLoader({ searchParams }: { searchParams: PageProps<"/checkout">["searchParams"] }) {
  const [auth, sp] = await Promise.all([getAuth(), searchParams]);
  if (!auth) redirect("/login?next=%2Fcheckout");
  const summary = await getCheckoutSummary(auth.user);
  const failed = sp.payment === "failed" && typeof sp.order === "string" ? sp.order.slice(0, 24) : null;
  if (!summary.cart.lines.length) {
    return (
      <>
        <MiniHeader />
        <section className="co-ck-empty">
          <div className="blk co-empty-hero is-mini">
            <EmptyArt />
            <div className="co-empty-t">
              <h1>Nothing to check out yet</h1>
              <p>Your cart is empty. Add a few favourites — every order comes with a free TBB Originals gift.</p>
              <div className="co-empty-btns">
                <Link className="btn btn-cart btn-lg" href="/">
                  Continue shopping <Icon name="arrow" />
                </Link>
                <Link className="btn btn-ghost btn-lg" href="/account/orders">
                  Your orders
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }
  return <CheckoutClient key={failed ?? "checkout"} initial={summary} paymentFailed={failed} />;
}

function MiniHeader() {
  return (
    <header className="co-mh">
      <div className="co-mh-in">
        <Link className="co-mh-logo" href="/" aria-label="The Big Brands home">
          <LogoMark />
        </Link>
        <span className="co-prog" />
        <span className="co-mh-sec">
          <XIcon name="lock" />
          <span>Secure checkout</span>
        </span>
      </div>
    </header>
  );
}

function CheckoutSkeleton() {
  return (
    <>
      <MiniHeader />
      <div className="co-ck" aria-busy="true" aria-label="Loading checkout">
        <div className="co-ck-main">
          <div className="cm-sk cm-sk-title" />
          <div className="cm-sk cm-sk-block" />
          <div className="cm-sk cm-sk-step" />
          <div className="cm-sk cm-sk-step" />
        </div>
        <aside className="co-ck-side">
          <div className="cm-sk cm-sk-sum" />
        </aside>
      </div>
    </>
  );
}
