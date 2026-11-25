import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { ProductCard } from "@/components/ui/product-card";
import { cx } from "@/components/ui/cx";
import { formatINR } from "@/lib/money";
import { getZoneSlot } from "@/server/ads/slots";
import { getCatalog, getStoreSettings } from "@/server/catalog/data";
import { getOriginals } from "@/server/catalog/home";
import { getGiftProgramme } from "@/server/catalog/offers";
import { Art, tintVar } from "@/components/catalog/visual";
import { GiftStatus, TierItem } from "@/components/catalog/gifts/gift-status";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/search.css";

export const metadata: Metadata = {
  title: "The Free Gift Store — a free TBB Originals mini in every order",
  description: "Shop any brand on The Big Brands and pick a free TBB Originals mini before you pay — up to 3 gifts per order. No coupon needed.",
  alternates: { canonical: "/gifts" },
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** /gifts — the Free Gift Store: the client's key differentiator (all cached reads; cart progress is a client island). */
export default async function GiftsPage() {
  const [{ tiers, gifts, maxGifts, worthUpTo }, settings, snap, originals, x1] = await Promise.all([getGiftProgramme(), getStoreSettings(), getCatalog(), getOriginals(12), getZoneSlot("X1")]);
  const hero = settings.heroes.gifts;
  const brandsN = snap.brands.filter((b) => !b.isOwn && b.productCount > 0).length;
  const tierTxt = (min: number) => (min <= 0 ? "On every order" : `On orders of ${formatINR(min)}+`);
  const floaters = gifts.slice(0, 3);
  const steps: [IconName, string, string][] = [
    ["bag", "Shop any brand", `Add anything from ${brandsN} brands — every product, every order qualifies.`],
    ["gift", "Pick your free mini", "At checkout, choose your TBB Originals gift before you pay. Change it any time until you pay."],
    ["truck", "Unbox both together", "Your gift travels in the same box as your order — no extra delivery charge."],
  ];
  const faq: [string, string][] = [
    ["Is the gift really free?", "Yes. Your mini is added at ₹0 — no coupon code, and your first gift has no minimum order value."],
    ["When do I choose my gift?", "On the checkout page, just before payment. You can change your pick until you pay."],
    ["Can I get more than one?", tiers.map((t) => `${plural(t.giftCount, "gift")} ${t.minAmount ? `on orders of ${formatINR(t.minAmount)} or more` : "on every order"}`).join(" · ") + "."],
    ["What if a mini runs out?", "Stock is live — a mini that runs out disappears from the picker until it’s restocked, and you choose another."],
    ["What if I return my order?", "Keep the gift — it’s yours. Returns of other items are not affected."],
  ];

  return (
    <div className="sr-page sr-gifts">
      <section className="wrap">
        <div className="sr-ghero">
          <div className="sr-ghero-copy">
            <span className="sr-kicker">
              <Icon name="sparkle" /> Only on The Big Brands
            </span>
            <h1>
              The <em>Free Gift</em> Store
            </h1>
            <p className="sr-lede">
              Shop any of our {brandsN} brands and pick a <b>TBB Originals</b> mini before you pay. It ships in the same box — on us.
            </p>
            <div className="sr-ghero-cta">
              <Link className="btn btn-cart btn-lg" href="/s?sort=best">
                Start shopping <Icon name="arrow" />
              </Link>
              <a className="btn btn-ghost btn-lg" href="#sr-how">
                How it works
              </a>
            </div>
            <ul className="sr-ghero-pts">
              <li>
                <Icon name="check" />
                No coupon needed
              </li>
              <li>
                <Icon name="check" />
                Up to {plural(maxGifts, "gift")} per order
              </li>
              {worthUpTo ? (
                <li>
                  <Icon name="check" />
                  Worth up to {formatINR(worthUpTo)}
                </li>
              ) : null}
            </ul>
          </div>
          <div className={cx("sr-ghero-art", hero && "has-photo")}>
            {hero ? (
              <span className="sr-ghero-photo">
                <Image src={hero.url} alt={hero.alt} fill sizes="(max-width: 960px) 92vw, 700px" loading="eager" fetchPriority="high" />
              </span>
            ) : null}
            {floaters.map((g, i) => (
              <span key={g.id} className={`sr-gfloat f${i}`} style={tintVar(g.product)} aria-hidden="true">
                <Art product={g.product} sizes="90px" />
                <small>{g.miniName.split(" ").slice(0, 2).join(" ")}</small>
              </span>
            ))}
            <div className="sr-gbox-tag" aria-hidden="true">
              <small>with every order</small>
              <b>Your pick</b>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap sr-sec">
        <div className="sr-tiers">
          <div className="sr-tiers-h">
            <span className="sr-kicker sr-kicker-d">
              <Icon name="layers" /> Gift tiers
            </span>
            <h2>The more you shop, the more you pick</h2>
            <p>Tiers apply automatically to your cart total.</p>
          </div>
          <ol className="sr-tierlist">
            {tiers.map((t, i) => (
              <TierItem key={t.minAmount} tier={t} last={i === tiers.length - 1}>
                <span className="sr-tier-n">{t.giftCount}</span>
                <div>
                  <b>{plural(t.giftCount, "free gift")}</b>
                  <small>{tierTxt(t.minAmount)}</small>
                </div>
              </TierItem>
            ))}
          </ol>
          <GiftStatus tiers={tiers} />
        </div>
      </section>

      <section className="wrap sr-sec" id="sr-how" aria-label="How it works">
        <div className="sr-steps">
          {steps.map(([ic, t, d], i) => (
            <div key={t} className="sr-step">
              <span className="sr-step-n">0{i + 1}</span>
              <span className="sr-step-ic">
                <Icon name={ic} />
              </span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {gifts.length ? (
        <section className="wrap sr-sec" aria-labelledby="sr-minis-h">
          <div className="blk">
            <div className="blk-h">
              <h2 id="sr-minis-h">Choose from {gifts.length} TBB Originals minis</h2>
              <span className="sr-blk-sub">Live stock · pick yours at checkout</span>
            </div>
            <div className="sr-minis">
              {gifts.map((g) => {
                const low = g.stock < 60;
                return (
                  <article key={g.id} className="sr-mini">
                    <Link className="sr-mini-img" href={`/p/${g.product.slug}`} style={tintVar(g.product)} aria-label={`${g.miniName} — see the full size`} prefetch={false}>
                      <Art product={g.product} sizes="(max-width: 700px) 40vw, 200px" />
                      <span className="sr-mini-free">FREE</span>
                    </Link>
                    <div className="sr-mini-b">
                      <b>{g.miniName}</b>
                      <span className="sr-mini-sz">{g.miniSize}</span>
                      <span className="sr-mini-pr">
                        <em>₹0</em>
                        <span>
                          worth <s>{formatINR(g.worth)}</s>
                        </span>
                      </span>
                      <span className={cx("sr-mini-st", low && "low")}>
                        <span style={{ width: `${Math.max(6, Math.min(100, g.stock / 7))}%` }} />
                      </span>
                      <small className="sr-mini-stt">{low ? `Only ${g.stock} left` : "In stock"}</small>
                      <Link className="sr-mini-full" href={`/p/${g.product.slug}`} prefetch={false}>
                        Full size {formatINR(g.product.price)}
                        <Icon name="chevRight" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {originals.length ? (
        <section className="wrap sr-sec" aria-labelledby="sr-full-h">
          <div className="blk">
            <div className="blk-h">
              <h2 id="sr-full-h">Loved your mini? Get the full size</h2>
              <Link className="link" href="/brand/tbb">
                Visit TBB Originals <Icon name="arrow" />
              </Link>
            </div>
            <div className="sr-grid sr-grid-6">
              {originals.map((p) => (
                <ProductCard key={p.id} product={p} compact sizes="(max-width: 700px) 46vw, 220px" />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {x1?.isActive ? (
        <section className="wrap sr-sec">
          <div className="sr-pitch sr-pitch-wide">
            <span className="sr-pitch-ic">
              <Icon name="box" />
            </span>
            <div>
              <h3>Brands: get inside thousands of boxes</h3>
              <p>Put your sample or flyer in every delivery — the beauty ad customers actually open. From {x1.rateLabel}.</p>
            </div>
            <Link className="link" href="/advertise">
              See in-box sampling <Icon name="arrow" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="wrap sr-sec">
        <div className="blk sr-faq">
          <h2>Good to know</h2>
          {faq.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>
                {q}
                <Icon name="chevDown" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wrap sr-sec">
        <div className="sr-cta">
          <div>
            <h2>Your free gift is one order away</h2>
            <p>Add anything to your cart — we&rsquo;ll take care of the rest.</p>
          </div>
          <div className="sr-cta-b">
            <Link className="btn btn-light btn-lg" href="/deals">
              <Icon name="zap" /> Today&rsquo;s Deals
            </Link>
            <Link className="btn btn-lg sr-btn-line" href="/brands">
              Brand stores <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
