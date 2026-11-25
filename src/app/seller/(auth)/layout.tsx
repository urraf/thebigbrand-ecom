import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { Toaster } from "@/components/ui/toast";
import { StoreLink } from "@/components/seller/store-link";
import { site } from "@/lib/site";
import "@/styles/seller/auth.css";

export const metadata: Metadata = {
  title: { default: "Seller Central", template: "%s · Seller Central · The Big Brands" },
};

/** Seller sign-in / application pages: no store chrome, split-screen brand panel + form. */
export default function SellerAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sa">
      <aside className="sa-brand" aria-label="About selling on The Big Brands">
        <StoreLink href="/" className="sa-logo" aria-label="The Big Brands store">
          <span className="logo-mark">
            <i aria-hidden="true">tbb</i>
          </span>
          <span className="sa-logo-t">
            <b>
              thebigbrands<em>.co.in</em>
            </b>
            <small>Seller Central</small>
          </span>
        </StoreLink>
        <div className="sa-pitch">
          <span className="sa-pill">
            <b>12% commission</b> No listing fees · weekly payouts
          </span>
          <h2>
            Sell your brands to India&apos;s <em>beauty shoppers</em>
          </h2>
          <p>Every order on The Big Brands ships with free gifts shoppers love — so they come back, and they buy more. List once, we bring the traffic.</p>
          <ul className="sa-ticks">
            <li>
              <Icon name="check" />
              <span>
                <b>Approved in 2 working days</b> — GSTIN, PAN and bank, that&apos;s it
              </span>
            </li>
            <li>
              <Icon name="check" />
              <span>
                <b>Paid every Wednesday</b> for everything delivered the week before
              </span>
            </li>
            <li>
              <Icon name="check" />
              <span>
                <b>Sponsored products from ₹5 a click</b> to jump to the top of search
              </span>
            </li>
          </ul>
        </div>
        <div className="sa-quote">
          <p>
            <b>Keep these handy:</b> GSTIN, PAN, a cancelled cheque or bank details, your pickup address and the brand authorisation letters for
            the brands you sell.
          </p>
          <footer>
            <i aria-hidden="true">
              <Icon name="clock" size={15} />
            </i>
            <span>
              <b>Takes about 5 minutes</b>Your progress is saved on this device.
            </span>
          </footer>
        </div>
        <p className="sa-brand-foot">
          © The Big Brands · {site.tagline} · Seller support: {site.sellerEmail}
        </p>
      </aside>
      <main className="sa-main" id="main">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
