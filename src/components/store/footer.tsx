import Link from "next/link";
import { cacheLife } from "next/cache";
import { site } from "@/lib/site";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "./logo";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/**
 * Store footer (demo footer()): back-to-top, advertiser band, link columns (incl. Sell on The Big Brands and
 * Seller login), app badges, and the © line with "A Shriram Ventures Initiative" + Image credits.
 */
export function Footer() {
  return (
    <>
      <button type="button" className="ft-top" data-chrome="to-top">
        Back to top
      </button>
      <div className="ft-grow">
        <div className="wrap ft-grow-in">
          <div className="ft-grow-ic">
            <Icon name="megaphone" />
          </div>
          <div>
            <b>Grow your brand on The Big Brands</b>
            <span>Billboards, sponsored products, reels &amp; in-box sampling — reach India’s beauty shoppers.</span>
          </div>
          <Link href="/advertise" className="btn btn-light">
            Start advertising <Icon name="arrow" />
          </Link>
        </div>
      </div>
      <div className="ft-main">
        <div className="wrap ft-grid">
          <nav aria-label="About">
            <h2>Get to know us</h2>
            <Link href="/about" prefetch={false}>About The Big Brands</Link>
            <Link href="/about#authentic" prefetch={false}>Authenticity promise</Link>
            <Link href="/brands" prefetch={false}>All brand stores</Link>
            <Link href="/contact" prefetch={false}>Contact us</Link>
          </nav>
          <nav aria-label="Make money with us">
            <h2>Make money with us</h2>
            <Link href="/sell" prefetch={false}>Sell on The Big Brands</Link>
            <Link href="/seller" prefetch={false}>Seller login</Link>
            <Link href="/advertise" prefetch={false}>Advertise your brand</Link>
            <Link href="/advertise#rate-card" prefetch={false}>Brand store subscription</Link>
            <Link href="/advertise#rate-card" prefetch={false}>In-box sampling</Link>
          </nav>
          <nav aria-label="Help">
            <h2>Let us help you</h2>
            <Link href="/account" prefetch={false}>Your account</Link>
            <Link href="/account/orders" prefetch={false}>Track your order</Link>
            <Link href="/cart" prefetch={false}>Your cart</Link>
            <Link href="/shipping" prefetch={false}>Shipping &amp; delivery</Link>
            <Link href="/returns" prefetch={false}>Returns, refunds &amp; cancellation</Link>
            <Link href="/help" prefetch={false}>Help centre</Link>
            <a href={`tel:${site.supportPhone.replace(/\s/g, "")}`}>Call us · {site.supportPhone}</a>
          </nav>
          <div className="ft-app">
            <h2>Shop on the app</h2>
            <p>Exclusive app-only deals &amp; faster checkout — launching soon.</p>
            <div className="app-btns">
              <span className="app-btn">
                <Icon name="phone" />
                <span>
                  <small>Get it on</small>Android
                </span>
              </span>
              <span className="app-btn">
                <Icon name="phone" />
                <span>
                  <small>Download for</small>iPhone
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="ft-bottom">
        <div className="wrap ft-bottom-in">
          <Link href="/" className="logo" title="The Big Brands — home">
            <LogoMark />
          </Link>
          <span className="ft-chips">
            <button type="button" className="chip-d" data-chrome="lang">
              <Icon name="globe" /> English
            </button>
            <span className="chip-d">₹ INR</span>
            <span className="chip-d">🇮🇳 India</span>
          </span>
          <span className="ft-copy">
            © <CopyrightYear /> The Big Brands · {site.tagline}. 100% authentic products, sourced from brands &amp; authorised
            distributors. <Link href="/terms" prefetch={false}>Terms of use</Link> · <Link href="/privacy" prefetch={false}>Privacy</Link> ·{" "}
            <Link href="/credits" prefetch={false}>Image credits</Link>
          </span>
        </div>
      </div>
    </>
  );
}
