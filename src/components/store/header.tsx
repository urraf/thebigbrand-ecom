import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { DeliverLabel, LocBarText } from "./location";
import { LogoMark } from "./logo";
import { getChromeData } from "./nav-data";
import { SearchBox } from "./search-box";
import {
  AccountLink,
  AccountLinkFallback,
  CartBadgeFallback,
  ServerCartBadge,
  ServerDeliverLabel,
  ServerLocBar,
} from "./session-slots";
import { SubNav } from "./subnav";

/**
 * Store header (demo header()): logo, deliver-to, big search, language, account, cart — then the sub-nav and
 * the mobile location bar. Everything is in the static shell; the per-user bits (greeting, deliver-to,
 * cart count) stream into their <Suspense> slots.
 */
export async function Header() {
  const { categories } = await getChromeData();
  return (
    <>
      <div className="hdr-main">
        <div className="wrap hdr-row">
          <button type="button" className="hdr-burger" data-chrome="menu-open" aria-label="Open menu" aria-controls="menu" aria-expanded="false">
            <Icon name="menu" />
          </button>
          <Link className="logo" href="/" title="The Big Brands — home">
            <LogoMark />
          </Link>
          <button type="button" className="hdr-loc" data-chrome="loc" aria-haspopup="dialog" title="Choose your delivery location">
            <Icon name="pin" />
            <Suspense fallback={<DeliverLabel />}>
              <ServerDeliverLabel />
            </Suspense>
          </button>
          <SearchBox categories={categories} />
          <button type="button" className="hdr-lang" data-chrome="lang" title="Language: English">
            <Icon name="globe" />
            <b>EN</b>
            <Icon name="chevDown" />
          </button>
          <Suspense fallback={<AccountLinkFallback />}>
            <AccountLink />
          </Suspense>
          <Link className="hdr-cart" href="/cart" prefetch={false}>
            <Icon name="cart" />
            <Suspense fallback={<CartBadgeFallback />}>
              <ServerCartBadge />
            </Suspense>
            <b aria-hidden="true">Cart</b>
          </Link>
        </div>
      </div>
      <SubNav categories={categories} />
      <button type="button" className="hdr-locbar" data-chrome="loc" aria-haspopup="dialog">
        <span className="wrap">
          <Suspense fallback={<LocBarText />}>
            <ServerLocBar />
          </Suspense>
        </span>
      </button>
    </>
  );
}
