import Link from "next/link";
import { getStoreSession } from "@/server/cart/session";
import { HydrateStore } from "@/components/cart/cart-context";
import { CartBadge, CartLabel } from "@/components/cart/cart-badge";
import { Icon } from "@/components/ui/icon";
import { DeliverLabel, LocBarText } from "./location";

/**
 * Per-user parts of the store chrome. Each is an async Server Component that reads the request session
 * (cookies) and MUST be rendered inside <Suspense> — the static shell ships the *Fallback versions.
 * getStoreSession() is memoised per request, so all slots share one set of queries.
 */

/** Streams the session into the client CartProvider (cart, user, wishlist, deliver-to). */
export async function StoreHydrator() {
  const data = await getStoreSession();
  return <HydrateStore data={data} />;
}

function AccountInner({ hello, label, href }: { hello: string; label: string; href: string }) {
  return (
    <Link className="hdr-acc" href={href} prefetch={false}>
      <small>{hello}</small>
      <b>
        {label} <Icon name="chevDown" />
      </b>
    </Link>
  );
}

/** "Hello, Priya · Account & Orders" (signed in) or "Hello, sign in" → /login. */
export async function AccountLink() {
  const { user } = await getStoreSession();
  if (!user) return <AccountInner hello="Hello, sign in" label="Account & Orders" href="/login" />;
  if (user.role === "ADMIN" || user.role === "STAFF") return <AccountInner hello={`Hello, ${user.firstName}`} label="Admin console" href="/admin" />;
  if (user.role === "SELLER") return <AccountInner hello={`Hello, ${user.firstName}`} label="Seller hub" href="/seller" />;
  return <AccountInner hello={`Hello, ${user.firstName}`} label="Account & Orders" href="/account" />;
}
export function AccountLinkFallback() {
  return <AccountInner hello="Hello" label="Account & Orders" href="/account" />;
}

/** Cart count pill with the server count in the HTML. */
export async function ServerCartBadge() {
  const { cart } = await getStoreSession();
  return (
    <>
      <CartBadge initialCount={cart.count} />
      <CartLabel initialCount={cart.count} />
    </>
  );
}
export function CartBadgeFallback() {
  return (
    <>
      <CartBadge />
      <CartLabel />
    </>
  );
}

/** Desktop "Deliver to Priya · New Delhi 110017". */
export async function ServerDeliverLabel() {
  const { deliverTo } = await getStoreSession();
  return <DeliverLabel initial={deliverTo} />;
}

/** Mobile location bar text. */
export async function ServerLocBar() {
  const { deliverTo } = await getStoreSession();
  return <LocBarText initial={deliverTo} />;
}
