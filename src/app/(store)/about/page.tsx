import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatINR } from "@/lib/money";
import { site } from "@/lib/site";
import { getCatalog, getStoreInfo, getStoreSettings } from "@/server/catalog/data";
import { getGiftProgramme } from "@/server/catalog/offers";
import { Art } from "@/components/catalog/visual";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/pages.css";

export const metadata: Metadata = {
  title: "About us — A Shriram Ventures Initiative",
  description: "The Big Brands is India's beauty marketplace: authentic products from the brands you love, honest prices, and a free gift you choose in every order.",
  alternates: { canonical: "/about" },
};

/** /about — brand story, authenticity promise, how the free gift works, contact. Static (cached reads). */
export default async function AboutPage() {
  const [snap, info, settings, gifts] = await Promise.all([getCatalog(), getStoreInfo(), getStoreSettings(), getGiftProgramme()]);
  const brands = snap.brands.filter((b) => !b.isOwn && b.productCount > 0);
  const hero = settings.heroes.gifts;
  const fan = gifts.gifts.slice(0, 4);
  const promise: [IconName, string, string][] = [
    ["shield", "100% authentic, always", "Every product comes straight from the brand or its authorised distributor. Third-party sellers are verified, and every listing is checked before it goes live."],
    ["tag", "Honest prices", "M.R.P. and the price you pay, side by side — no inflated strike-throughs. Deals are real and end when we say they do."],
    ["ret", "7-day easy returns", "Changed your mind or something arrived damaged? Return it within 7 days of delivery — and keep the free gift."],
    ["truck", "Fast, careful delivery", `Free delivery on orders of ${formatINR(site.freeShippingMin)} and above, packed so your bottles arrive the way they left.`],
  ];
  return (
    <div className="pg-page wrap ab">
      <section className="ab-hero">
        <div className="ab-hero-copy">
          <span className="ab-kick">
            <Icon name="sparkle" /> A Shriram Ventures Initiative
          </span>
          <h1>
            The Big Brands — beauty you can <em>trust</em>, with a gift in every box.
          </h1>
          <p>
            We started The Big Brands with a simple idea: the beauty brands India loves, sold authentically, at honest prices — and a little something extra for you in every
            order. Today {brands.length} brands and {snap.entries.length} products live here, and every single order ships with a free TBB Originals mini you choose yourself.
          </p>
          <div className="ab-cta">
            <Link className="btn btn-cart btn-lg" href="/s?sort=best">
              Shop bestsellers <Icon name="arrow" />
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/gifts">
              How the free gift works
            </Link>
          </div>
        </div>
        <div className="ab-hero-art" aria-hidden="true">
          {hero ? <Image src={hero.url} alt="" fill sizes="(max-width: 960px) 92vw, 640px" loading="eager" fetchPriority="high" /> : null}
          <div className="ab-fan">
            {fan.map((g) => (
              <span key={g.id}>
                <Art product={g.product} sizes="90px" />
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-stats" aria-label="The Big Brands in numbers">
        <div>
          <b>{brands.length}</b>
          <span>official brand stores</span>
        </div>
        <div>
          <b>{snap.entries.length}</b>
          <span>authentic products</span>
        </div>
        <div>
          <b>{gifts.maxGifts}</b>
          <span>free gifts per order, max</span>
        </div>
        <div>
          <b>7 days</b>
          <span>easy returns</span>
        </div>
      </section>

      <section className="pg-sec" id="authentic" aria-labelledby="ab-promise">
        <h2 id="ab-promise" className="ab-h">
          Our authenticity promise
        </h2>
        <div className="ab-grid">
          {promise.map(([ic, t, d]) => (
            <div key={t} className="ab-card">
              <span className="ab-ic">
                <Icon name={ic} />
              </span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pg-sec ab-gift" aria-labelledby="ab-gift">
        <div>
          <h2 id="ab-gift" className="ab-h">
            How the free gift works
          </h2>
          <p>
            Every order on The Big Brands includes a full-quality mini from <b>TBB Originals</b> — our own label. You pick it at checkout, <b>before you pay</b>. Bigger bags unlock
            more picks:
          </p>
          <ul className="ab-tiers">
            {gifts.tiers.map((t) => (
              <li key={t.minAmount}>
                <b>
                  {t.giftCount} free gift{t.giftCount > 1 ? "s" : ""}
                </b>
                <span>{t.minAmount > 0 ? `on orders of ${formatINR(t.minAmount)}+` : "on every order"}</span>
              </li>
            ))}
          </ul>
          <Link className="link" href="/gifts">
            Visit the Free Gift Store <Icon name="arrow" />
          </Link>
        </div>
      </section>

      <section className="pg-sec ab-brands" aria-labelledby="ab-brands">
        <h2 id="ab-brands" className="ab-h">
          Brands that call The Big Brands home
        </h2>
        <div className="ab-logos">
          {brands.map((b) => (
            <Link key={b.id} href={`/brand/${b.slug}`} prefetch={false}>
              {b.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="pg-sec ab-contact blk" aria-labelledby="ab-contact">
        <h2 id="ab-contact" className="ab-h">
          Get in touch
        </h2>
        <div className="ab-cgrid">
          <div>
            <h3>Customer care</h3>
            <p>
              <a href={`mailto:${info.supportEmail}`}>{info.supportEmail}</a>
              <br />
              <a href={`tel:${info.supportPhone.replace(/\s+/g, "")}`}>{info.supportPhone}</a> (toll-free, 9am–9pm)
            </p>
          </div>
          <div>
            <h3>Brands &amp; advertising</h3>
            <p>
              <a href={`mailto:${site.adsEmail}`}>{site.adsEmail}</a>
              <br />
              <Link href="/advertise">Advertise with us</Link>
            </p>
          </div>
          <div>
            <h3>Sell on The Big Brands</h3>
            <p>
              <a href={`mailto:${site.sellerEmail}`}>{site.sellerEmail}</a>
              <br />
              <Link href="/sell">Become a seller</Link>
            </p>
          </div>
          <div>
            <h3>Registered office</h3>
            <p>
              {info.legalName}
              {info.address ? (
                <>
                  <br />
                  {info.address}
                </>
              ) : null}
              {info.gstin ? (
                <>
                  <br />
                  GSTIN {info.gstin}
                </>
              ) : null}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
