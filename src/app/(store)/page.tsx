import type { Metadata } from "next";
import { AdZone } from "@/components/ads";
import { GiftPromo, OriginalsBanner } from "@/components/catalog/home/house";
import { site } from "@/lib/site";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/home.css";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — India's beauty marketplace with a free gift in every order` },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: { title: site.name, description: site.description, type: "website" },
};

/**
 * HOME — the ads-first marketplace homepage (port of docs/theme-reference js/pages/home.js). Every paid
 * placement is an <AdZone> (renders nothing when its slot is paused or empty); the client's own house blocks
 * (free-gift promo, TBB Originals, trending searches) sit between them. All reads are cached, so the whole
 * page is a static shell — nothing per-user blocks it (cart/wishlist hydrate in client islands).
 */
export default function HomePage() {
  return (
    <div className="hm">
      <h1 className="sr-only">The Big Brands — shop India&rsquo;s favourite beauty brands, with a free gift in every order</h1>
      <AdZone code="H1" />
      <AdZone code="H2" />
      <AdZone code="H4" />
      <AdZone code="H3" />
      <section className="wrap hm-sec hm-dealrow" aria-label="Deal of the day and free gifts">
        <AdZone code="H10" />
        <GiftPromo />
      </section>
      <AdZone code="H5" />
      <AdZone code="H6" />
      <AdZone code="H8" />
      <AdZone code="H9" />
      <AdZone code="H11" />
      <AdZone code="H7" />
      <OriginalsBanner />
    </div>
  );
}
