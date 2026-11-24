import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { MenuGreeting } from "./menu-greeting";
import { getChromeData } from "./nav-data";

/**
 * "All categories" drawer (demo menu()). Server-rendered links (cached catalogue data); opened/closed by
 * the chrome client via `data-chrome="menu-open|menu-close"`. Starts inert so its links aren't tabbable
 * while it's off-screen.
 */
export async function MenuDrawer() {
  const { categories, concerns, brands } = await getChromeData();
  return (
    <div id="menu" role="dialog" aria-modal="true" aria-label="All categories" aria-hidden="true" inert>
      <div className="mn-head">
        <span className="mn-av">
          <Icon name="user" />
        </span>
        <MenuGreeting />
        <button type="button" className="ib-sm" data-chrome="menu-close" aria-label="Close menu">
          <Icon name="close" />
        </button>
      </div>
      <nav className="mn-body" aria-label="Shop by category, concern and brand">
        <h5>Trending</h5>
        <Link href="/s?sort=best" prefetch={false}>Bestsellers</Link>
        <Link href="/deals" prefetch={false}>Today’s Deals</Link>
        <Link href="/s?sort=new" prefetch={false}>New launches</Link>
        <Link href="/gifts" prefetch={false}>
          <Icon name="gift" /> <span>Free Gift Store</span>
        </Link>

        <h5>Shop by category</h5>
        {categories.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} prefetch={false}>
            {c.name}
            <Icon name="chevRight" />
          </Link>
        ))}

        <h5>Shop by concern</h5>
        {concerns.map((c) => (
          <Link key={c.slug} href={`/s?concern=${encodeURIComponent(c.slug)}`} prefetch={false}>
            {c.emoji ? <span aria-hidden="true">{c.emoji}</span> : null} {c.name}
          </Link>
        ))}

        <h5>Top brands</h5>
        {brands.map((b) => (
          <Link key={b.slug} href={`/brand/${b.slug}`} prefetch={false}>
            {b.name}
          </Link>
        ))}
        <Link href="/brands" prefetch={false}>
          See all brand stores
          <Icon name="chevRight" />
        </Link>

        <h5>Your account</h5>
        <Link href="/account/orders" prefetch={false}>
          <Icon name="box" /> <span>Your orders</span>
        </Link>
        <Link href="/account/wishlist" prefetch={false}>
          <Icon name="heart" /> <span>Your wishlist</span>
        </Link>
        <Link href="/cart" prefetch={false}>
          <Icon name="cart" /> <span>Your cart</span>
        </Link>

        <h5>For brands &amp; sellers</h5>
        <Link href="/sell" prefetch={false}>
          <Icon name="store" /> <span>Sell on The Big Brands</span>
        </Link>
        <Link href="/seller" prefetch={false}>
          <Icon name="user" /> <span>Seller login</span>
        </Link>
        <Link href="/advertise" prefetch={false}>
          <Icon name="megaphone" /> <span>Advertise with us</span>
        </Link>
        <button type="button" data-chrome="inspect">
          <Icon name="eye" /> <span>Show / hide ad slots</span>
        </button>
      </nav>
    </div>
  );
}
