import Link from "next/link";
import { Suspense } from "react";
import { requireUserPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { Icon, type IconName } from "@/components/ui/icon";
import { firstNameOf } from "@/server/cart/session";
import { getAccountOverview } from "@/server/account/overview";
import { OrderRow } from "@/components/commerce/account/order-row";
import { AccSkeleton } from "@/components/commerce/account/skeleton";

export const metadata = { title: "Overview" };

/** /account — greeting, stats, recent orders and quick links. */
export default function AccountHome() {
  return (
    <Suspense fallback={<AccSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const auth = await requireUserPage("/account");
  const o = await getAccountOverview(auth.user.id);
  const name = firstNameOf(o.profile.name ?? o.defaultAddress?.name, "there");
  const since = new Date(o.profile.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const links: { href: string; icon: IconName; title: string; sub: string }[] = [
    { href: "/account/orders", icon: "box", title: "Your orders", sub: o.stats.active ? `${o.stats.active} on the way` : "Track, return or buy again" },
    { href: "/account/addresses", icon: "pin", title: "Addresses", sub: o.defaultAddress ? `${o.defaultAddress.city} ${o.defaultAddress.pincode}` : "Add a delivery address" },
    { href: "/account/wishlist", icon: "heart", title: "Wishlist", sub: o.wishlistCount ? `${o.wishlistCount} saved` : "Save products you love" },
    { href: "/account/profile", icon: "user", title: "Profile & security", sub: o.profile.phone ? `+91 ${o.profile.phone}` : (o.profile.email ?? "Your details") },
  ];
  return (
    <>
      <header className="blk cm-acc-hero">
        <div>
          <p className="cm-acc-k">Member since {since}</p>
          <h1>Hello, {name}</h1>
          <p className="muted">Here&rsquo;s everything about your orders, free gifts and savings.</p>
        </div>
        <dl className="cm-stats">
          <div>
            <dt>Orders</dt>
            <dd>{o.stats.orders}</dd>
          </div>
          <div>
            <dt>Free gifts received</dt>
            <dd>{o.stats.giftsReceived}</dd>
          </div>
          <div className="is-save">
            <dt>Total saved</dt>
            <dd>{formatINR(o.stats.totalSaved)}</dd>
          </div>
        </dl>
      </header>
      <ul className="cm-quick">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>
              <span className="cm-quick-ic">
                <Icon name={l.icon} />
              </span>
              <span>
                <b>{l.title}</b>
                <small>{l.sub}</small>
              </span>
              <Icon name="chevRight" />
            </Link>
          </li>
        ))}
      </ul>
      <section className="blk cm-acc-sec" aria-labelledby="acc-recent">
        <div className="co-sec-h">
          <div>
            <h2 id="acc-recent">Recent orders</h2>
            <p>Every order includes free TBB Originals gifts you picked.</p>
          </div>
          {o.recentOrders.length ? (
            <Link className="link" href="/account/orders">
              See all <Icon name="chevRight" />
            </Link>
          ) : null}
        </div>
        {o.recentOrders.length ? (
          <ul className="cm-orders">
            {o.recentOrders.map((r) => (
              <OrderRow key={r.number} o={r} />
            ))}
          </ul>
        ) : (
          <div className="cm-empty">
            <Icon name="bag" />
            <p>
              <b>No orders yet</b>
              Your first order comes with a free gift you choose.
            </p>
            <Link className="btn btn-cart" href="/">
              Start shopping
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
