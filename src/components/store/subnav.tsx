import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import type { ChromeCategory } from "./nav-data";

/**
 * Sub-navbar (demo .subnav): All menu, Today's Deals, Free Gift Store, Brand Stores, categories, Bestsellers
 * and the "Advertise with us" pill. Categories beyond the sixth collapse on narrower desktops (they're
 * always in the All menu). Active link is marked client-side (`data-nav`) so the shell stays static.
 */
export function SubNav({ categories }: { categories: ChromeCategory[] }) {
  return (
    <nav className="subnav" aria-label="Shop navigation">
      <div className="wrap subnav-row">
        <button type="button" className="sn-all" data-chrome="menu-open" aria-controls="menu" aria-expanded="false">
          <Icon name="menu" />
          <span>All</span>
        </button>
        <Link href="/deals" className="sn-deal" data-nav="/deals">
          <Icon name="zap" />
          Today’s Deals
        </Link>
        <Link href="/gifts" className="sn-gift" data-nav="/gifts">
          <Icon name="gift" />
          Free Gift Store
        </Link>
        <Link href="/brands" data-nav="/brands">
          Brand Stores
        </Link>
        {categories.map((c, i) => (
          <Link key={c.slug} href={`/c/${c.slug}`} data-nav={`/c/${c.slug}`} className={cx(i >= 6 ? "sn-c6" : i >= 4 ? "sn-c4" : i >= 2 ? "sn-c2" : null)} prefetch={false}>
            {c.short}
          </Link>
        ))}
        <Link href="/s?sort=best" data-nav="/s?sort=best" prefetch={false}>
          Bestsellers
        </Link>
        <Link href="/advertise" className="sn-grow" data-nav="/advertise">
          <Icon name="megaphone" />
          Advertise with us
        </Link>
      </div>
    </nav>
  );
}
