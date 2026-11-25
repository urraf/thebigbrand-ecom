import type { Metadata } from "next";
import Link from "next/link";
import { AdZone } from "@/components/ads";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { compactNumber } from "@/lib/money";
import { getZoneSlot } from "@/server/ads/slots";
import { BRAND_GROUPS, brandGroupsOf, getBrandDirectory } from "@/server/catalog/brands";
import { getCatalog } from "@/server/catalog/data";
import { norm } from "@/server/catalog/text";
import { Art } from "@/components/catalog/visual";
import { BrandFilter } from "@/components/catalog/brands/brands-client";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/search.css";

export const metadata: Metadata = {
  title: "Brand Stores — official stores of India's favourite beauty brands",
  description: "Shop the official stores of L'Oréal Paris, Cetaphil, Minimalist, Himalaya, Mamaearth and more on The Big Brands — 100% authentic, with a free gift in every order.",
  alternates: { canonical: "/brands" },
};

const plural = (n: number, w: string) => `${n.toLocaleString("en-IN")} ${w}${n === 1 ? "" : "s"}`;

/** /brands — the brand directory (static: cached catalogue; the find/filter box filters tiles in the browser). */
export default async function BrandsPage() {
  const [brands, b1, snap] = await Promise.all([getBrandDirectory(), getZoneSlot("B1"), getCatalog()]);
  const stores = snap.brands.filter((b) => b.storeActive && !b.isOwn).length;
  const groups = BRAND_GROUPS.filter(([key, , cats]) => key === "all" || brands.some((b) => cats.some((c) => b.categories.includes(c)))).map(([key, label]) => ({ key, label }));
  const mock = snap.entries.filter((e) => e.card.image && !e.card.isOwnLabel).slice(0, 4).map((e) => e.card);

  return (
    <div className="sr-page sr-brands">
      <section className="wrap">
        <div className="sr-dirhead">
          <div className="sr-dirhead-copy">
            <nav className="sr-crumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <Icon name="chevRight" />
              <span aria-current="page">Brand stores</span>
            </nav>
            <h1>Brand Stores</h1>
            <p>Official stores of {brands.length} beauty brands — 100% authentic, sourced direct, and every order ships with a free gift.</p>
          </div>
          <BrandFilter groups={groups} tiles={brands.map((b) => ({ name: norm(`${b.displayName} ${b.name} ${b.word ?? ""} ${b.tagline ?? ""}`), groups: brandGroupsOf(b) }))} />
        </div>
      </section>

      <AdZone code="H7" />

      <section className="wrap sr-sec" aria-labelledby="sr-allb">
        <div className="sr-sech">
          <h2 id="sr-allb">
            All brands <span className="sr-count-n" id="sr-bcount">{brands.length}</span>
          </h2>
        </div>
        <div className="sr-bgrid" id="sr-bgrid">
          {brands.map((b) => (
            <Link
              key={b.id}
              className={cx("sr-bt", b.isOwn && "is-own")}
              href={`/brand/${b.slug}`}
              data-name={norm(`${b.displayName} ${b.name} ${b.word ?? ""} ${b.tagline ?? ""}`)}
              data-groups={brandGroupsOf(b).join(" ")}
              prefetch={false}
            >
              <span className="sr-bt-top" style={{ "--ba": b.isOwn ? "#fff0f3" : b.accent || "#f4f3f8" } as React.CSSProperties}>
                <span className="sr-bt-logo">
                  <BrandLogo brand={b} size={b.word && b.word.length > 10 ? 17 : 22} />
                </span>
                <span className="sr-bt-arts" aria-hidden="true">
                  {b.top.map((p) => (
                    <span key={p.id}>
                      <Art product={p} sizes="56px" />
                    </span>
                  ))}
                </span>
                {b.isOwn ? <span className="sr-bt-own">Free-gift label</span> : null}
              </span>
              <span className="sr-bt-b">
                <b>
                  {b.displayName}
                  <span className="sr-verified" title="Official store">
                    <Icon name="check" />
                  </span>
                </b>
                <small>{b.tagline ?? ""}</small>
                <span className="sr-bt-meta">
                  <span>{plural(b.productCount, "product")}</span>
                  {b.avgRating ? (
                    <span>
                      <Icon name="star" />
                      {b.avgRating.toFixed(1)}
                    </span>
                  ) : null}
                  <span>{compactNumber(b.followers)} followers</span>
                </span>
              </span>
              <span className="sr-bt-go">
                Visit store <Icon name="arrow" />
              </span>
            </Link>
          ))}
        </div>
        <div className="sr-bnone blk" id="sr-bnone" hidden>
          <b>No brands match your search</b>
          <p className="muted">Try another name, or clear the filters to see all brands.</p>
        </div>
      </section>

      <section className="wrap sr-sec">
        <div className="sr-bpitch">
          <div className="sr-bp-copy">
            <span className="sr-kicker sr-kicker-d">
              <Icon name="megaphone" /> For brands
            </span>
            <h2>Get your own brand store</h2>
            <p>Your banner, wordmark, coupons and full catalogue on one page you control — plus a spot in &ldquo;Similar brands&rdquo; across the site.</p>
            <ul>
              <li>
                <Icon name="check" />
                Custom hero banner in your brand colours
              </li>
              <li>
                <Icon name="check" />
                Followers, coupons &amp; store analytics
              </li>
              <li>
                <Icon name="check" />
                Listed in this directory and in search
              </li>
            </ul>
            <div className="sr-bp-buy">
              {b1 ? (
                <div className="sr-bp-price">
                  <b>{b1.rateLabel.split("/")[0]}</b>
                  <span>
                    /{b1.rateLabel.split("/")[1] ?? "month"}
                    <br />
                    B1 · Brand Store
                  </span>
                </div>
              ) : null}
              <Link className="btn btn-cart btn-lg" href="/advertise">
                Book a brand store <Icon name="arrow" />
              </Link>
            </div>
            {b1?.positions ? (
              <small className="sr-bp-scar">
                <Icon name="zap" /> {Math.min(stores, b1.positions)} of {b1.positions} stores taken this month
              </small>
            ) : null}
          </div>
          <div className="sr-bp-mock" aria-hidden="true">
            <div className="sr-bp-win">
              <i />
              <i />
              <i />
              <span>thebigbrands.co.in/brand/your-brand</span>
            </div>
            <div className="sr-bp-hero">
              <b>YOUR BRAND</b>
              <small>Your tagline here</small>
              <span className="sr-bp-fol">
                <Icon name="plus" /> Follow
              </span>
            </div>
            <div className="sr-bp-tabs">
              <span className="on">All</span>
              <span>Bestsellers</span>
              <span>Offers</span>
            </div>
            <div className="sr-bp-grid">
              {mock.map((p) => (
                <span key={p.id}>
                  <Art product={p} sizes="90px" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
