import Link from "next/link";
import { notFound } from "next/navigation";
import { AdZone } from "@/components/ads";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import { Stars } from "@/components/ui/stars";
import { boughtLabel } from "@/components/ui/product-card";
import { discountPct, formatINR } from "@/lib/money";
import { site } from "@/lib/site";
import type { ProductCardData } from "@/types/shared";
import { couponValidity, getCouponsForBrand, getGiftProgramme, type CouponOffer } from "@/server/catalog/offers";
import { getProductDetail, getProductReviews, getRecommendations, type ProductDetail } from "@/server/catalog/product";
import { Art, tintVar } from "@/components/catalog/visual";
import { FrequentlyBought } from "./fbt";
import { Gallery } from "./gallery";
import { BuyBox, ClipCoupon, CopyCode, HelpfulButton, OffersScroller, PackPicker, PdpProvider, QuickBuyBars, ReviewsLink } from "./pdp-client";

const INGREDIENT_COLORS = ["#ff7a45", "#5b35e0", "#0f9f6e", "#e0a100", "#d6234f", "#1b6fb3"];
const SKIP_INGREDIENTS = /^(aqua|water|purified water|glycerin|fragrance|parfum|pigments?)$/i;
const AVATARS = ["#5b35e0", "#0f9f6e", "#d6234f", "#e07a00", "#1b6fb3", "#8e3b8f"];

export const brandLabel = (p: Pick<ProductCardData, "brand">) => (p.brand.isOwn ? "TBB Originals" : p.brand.name);
export const productTitle = (d: ProductDetail) => `${d.brand.displayName} ${d.card.name}${d.card.size ? `, ${d.card.size}` : ""}`;

function unitPrice(p: ProductCardData): string | null {
  const m = String(p.size ?? "").match(/([\d.]+)\s*(ml|g)\b/i);
  if (!m) return null;
  const q = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (!q) return null;
  const v = q >= 20 ? (p.price / q) * 100 : p.price / q;
  return `${formatINR(v, { decimals: true })}/${q >= 20 ? `100 ${u}` : u}`;
}

function ingredientChips(text: string | null) {
  return String(text ?? "")
    .replace(/\.$/, "")
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter((s) => s && s.length < 48 && !SKIP_INGREDIENTS.test(s))
    .slice(0, 6)
    .map((name, i) => ({ name, color: INGREDIENT_COLORS[i % INGREDIENT_COLORS.length] }));
}

function couponLine(c: CouponOffer): string {
  const v = c.type === "PERCENT" ? `${c.value}% off` : c.type === "FLAT" ? `${formatINR(c.value)} off` : "Buy 1 Get 1";
  const min = c.minOrder > 0 ? ` on orders of ${formatINR(c.minOrder)}+` : "";
  const cap = c.type === "PERCENT" && c.maxDiscount ? ` (up to ${formatINR(c.maxDiscount)})` : "";
  const till = couponValidity(c);
  return `${v}${cap}${min}${till ? ` · valid till ${till}` : ""}.`;
}

const dateIN = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/** Product JSON-LD (offers + aggregateRating) — escaped so no "</script>" can break out. */
function JsonLd({ d }: { d: ProductDetail }) {
  const p = d.card;
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productTitle(d),
    description: d.description ?? undefined,
    sku: d.sku ?? p.id,
    image: d.images.map((i) => (i.url.startsWith("/") ? `https://${site.domain}${i.url}` : i.url)),
    brand: { "@type": "Brand", name: d.brand.displayName },
    category: d.category.name,
    offers: {
      "@type": "Offer",
      url: `https://${site.domain}/p/${p.slug}`,
      priceCurrency: "INR",
      price: p.price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: d.seller?.displayName ?? "The Big Brands Retail" },
    },
    aggregateRating: p.reviewCount > 0 ? { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount, bestRating: 5, worstRating: 1 } : undefined,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** The product detail page body (inside <Suspense> — it awaits the slug). */
export async function ProductPage({ slug }: { slug: string }) {
  const d = await getProductDetail(slug);
  if (!d) notFound();
  const p = d.card;
  const [reviews, recs, coupons, gifts] = await Promise.all([getProductReviews(p.id, { limit: 8 }), getRecommendations(p.id), getCouponsForBrand(d.brand.slug), getGiftProgramme()]);
  const title = productTitle(d);
  const off = discountPct(p.mrp, p.price);
  const up = unitPrice(p);
  const seller = d.seller?.displayName ?? "The Big Brands Retail";
  const rankLabel = p.isOwnLabel ? "TBB Original" : d.rank > 0 && d.rank <= 10 ? `#${d.rank} Bestseller in ${d.category.name}` : "";
  const ings = ingredientChips(d.ingredients);
  const giftMini = gifts.gifts[0]?.product ?? null;
  const worthMax = gifts.gifts.reduce((m, g) => Math.max(m, g.worth), 0);
  const brandCoupons = coupons.slice(0, 3);
  const together = [p, ...recs.together].slice(0, 3);
  const compare = [p, ...recs.similar].slice(0, 4);
  const bought = boughtLabel(p.soldCount);
  const giftViews = gifts.gifts.map((g) => ({ id: g.id, name: g.miniName, size: g.miniSize, product: g.product }));

  const facts: [string, string][] = [
    ["Brand", d.brand.displayName],
    ["Category", d.category.name],
    ...(p.size ? ([["Net quantity", p.size]] as [string, string][]) : []),
    ...(d.concerns.length ? ([["Good for", d.concerns.map((c) => c.name).join(", ")]] as [string, string][]) : []),
    ["Sold by", seller],
    ...(d.sku ? ([["SKU", d.sku]] as [string, string][]) : []),
  ];
  const details = (
    <>
      <dl className="pd-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <hr className="pd-hr" />
      {d.bullets.length || d.description ? (
        <>
          <h2 className="pd-h">About this item</h2>
          {d.description ? <p className="pd-desc">{d.description}</p> : null}
          {d.bullets.length ? (
            <ul className="pd-about">
              {d.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {ings.length ? (
        <>
          <h2 className="pd-h">Key ingredients</h2>
          <ul className="pd-ings">
            {ings.map((i) => (
              <li key={i.name} style={{ "--c": i.color } as React.CSSProperties}>
                <i />
                <span>
                  <b>{i.name}</b>
                </span>
              </li>
            ))}
          </ul>
          {d.ingredients ? <p className="pd-inglist">Full list: {d.ingredients}</p> : null}
        </>
      ) : null}
      {d.howToUse ? (
        <>
          <h2 className="pd-h">How to use</h2>
          <p className="pd-desc">{d.howToUse}</p>
        </>
      ) : null}
    </>
  );

  return (
    <PdpProvider product={p} tiers={gifts.tiers}>
      <JsonLd d={d} />
      <div className="pd-page">
        <div className="wrap">
          <div className="pd-crumbs-row">
            <nav className="pd-crumbs" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <Icon name="chevRight" />
              <Link href={`/c/${d.category.slug}`}>{d.category.name}</Link>
              <Icon name="chevRight" />
              <Link href={`/brand/${d.brand.slug}`}>{d.brand.displayName}</Link>
              <span className="pd-crumbs-cur" aria-current="page">
                <Icon name="chevRight" />
                {p.name}
              </span>
            </nav>
            <Link className="pd-promise" href="/gifts">
              <Icon name="gift" />
              <span>Free gift with every order</span>
            </Link>
          </div>

          <section className="pd-top">
            <div className="pd-main blk">
              <Gallery product={p} images={d.images} badge={p.badge} ingredients={ings} gift={giftMini} title={title} />
              <div className="pd-info">
                <Link className="pd-store" href={`/brand/${d.brand.slug}`}>
                  <Icon name="store" />
                  Visit the {d.brand.displayName} Store
                </Link>
                <h1 className="pd-title">{title}</h1>
                <div className="pd-rate-row">
                  {p.reviewCount ? (
                    <>
                      <span className="pd-rate-n">{p.rating.toFixed(1)}</span>
                      <Stars rating={p.rating} />
                      <ReviewsLink>{p.reviewCount.toLocaleString("en-IN")} ratings</ReviewsLink>
                    </>
                  ) : (
                    <span className="pd-bought">New arrival — be the first to review</span>
                  )}
                  {bought ? (
                    <>
                      <span className="pd-sep" aria-hidden="true" />
                      <span className="pd-bought">{bought}</span>
                    </>
                  ) : null}
                </div>
                <div className="pd-badges">
                  {p.isOwnLabel ? (
                    <>
                      <span className="pd-best pd-best-own">
                        <Icon name="sparkle" />
                        TBB Original
                      </span>
                      <span>Made by The Big Brands</span>
                    </>
                  ) : d.rank > 0 && d.rank <= 10 ? (
                    <>
                      <span className="pd-best">#{d.rank} Bestseller</span>
                      <span>
                        in <Link href={`/c/${d.category.slug}?sort=best`}>{d.category.name}</Link>
                      </span>
                    </>
                  ) : null}
                </div>
                {p.isOwnLabel ? (
                  <div className="pd-own">
                    <Icon name="gift" />
                    <p>
                      <b>This is our own label.</b> Love the free mini? This is the full size{p.size ? ` ${p.size}` : ""} — and you still get a free gift with this order.
                    </p>
                  </div>
                ) : null}
                <hr className="pd-hr" />
                {off >= 15 ? (
                  <span className="pd-deal">
                    <Icon name="zap" />
                    Limited time deal
                  </span>
                ) : null}
                <div className="pd-price">
                  <Price price={p.price} mrp={p.mrp} big />
                </div>
                <p className="pd-tax">
                  Inclusive of all taxes
                  {up ? (
                    <>
                      {" "}
                      · <span>{up}</span>
                    </>
                  ) : null}
                </p>

                <div className="pd-offers-h">
                  <Icon name="tag" />
                  <b>Offers</b>
                  <span>
                    {brandCoupons.length + 1} offer{brandCoupons.length ? "s" : ""} on this item
                  </span>
                </div>
                <OffersScroller>
                  <div role="listitem" className="pd-of pd-of-gift">
                    <b>
                      <Icon name="gift" /> Free TBB gift
                    </b>
                    <p>Pick a complimentary TBB Original at checkout{worthMax ? ` — worth up to ${formatINR(worthMax)}` : ""}.</p>
                    <Link className="link" href="/gifts">
                      See all gifts
                    </Link>
                  </div>
                  {brandCoupons.map((c) => (
                    <div role="listitem" key={c.id} className="pd-of pd-of-cp">
                      <b>
                        <Icon name="scissors" /> {c.brandSlug ? `${c.brandName} coupon` : "Coupon"}
                      </b>
                      <p>{couponLine(c)}</p>
                      {c.isSponsored ? <ClipCoupon couponId={c.id} label={c.brandName ?? c.title} /> : <CopyCode code={c.code} />}
                    </div>
                  ))}
                </OffersScroller>

                <ul className="pd-svc">
                  <li>
                    <Icon name="truck" />
                    <span>{p.price >= site.freeShippingMin ? "Free delivery" : `Free over ${formatINR(site.freeShippingMin)}`}</span>
                  </li>
                  <li>
                    <Icon name="ret" />
                    <span>7-day returns</span>
                  </li>
                  <li>
                    <Icon name="shield" />
                    <span>100% authentic</span>
                  </li>
                  <li>
                    <Icon name="card" />
                    <span>Pay on delivery</span>
                  </li>
                  <li className="pd-svc-gift">
                    <Icon name="gift" />
                    <span>Free TBB gift</span>
                  </li>
                </ul>
                <hr className="pd-hr" />
                <PackPicker unitPrice={up} />
                <div className="pd-details-d">{details}</div>
              </div>
            </div>
            <aside className="pd-side" aria-label="Buy box">
              <BuyBox gifts={giftViews} seller={seller} ownLabel={p.isOwnLabel || d.brand.isOwn} />
              <AdZone code="P2" context={{ productId: p.id, categorySlug: d.category.slug }} />
            </aside>
            <section className="pd-details-m blk" aria-label="Product details">
              <h2 className="pd-h pd-h-lg">Product details</h2>
              {details}
            </section>
          </section>

          <div className="pd-p1">
            <AdZone code="P1" context={{ productId: p.id, excludeProductIds: together.map((x) => x.id) }} />
          </div>

          {together.length > 1 ? <FrequentlyBought items={together} tiers={gifts.tiers} /> : null}

          {compare.length > 1 ? <Compare items={compare} /> : null}

          <section className="pd-rev blk" id="pd-reviews" aria-labelledby="pd-rev-h" tabIndex={-1}>
            <div className="pd-rev-grid">
              <div className="pd-rev-sum">
                <h2 id="pd-rev-h">Customer reviews</h2>
                {p.reviewCount ? (
                  <>
                    <div className="pd-rev-avg">
                      <Stars rating={p.rating} />
                      <b>{p.rating.toFixed(1)} out of 5</b>
                    </div>
                    <p className="pd-rev-tot">{p.reviewCount.toLocaleString("en-IN")} global ratings</p>
                  </>
                ) : (
                  <p className="pd-rev-tot">No ratings yet</p>
                )}
                {reviews.count ? (
                  <ul className="pd-hist" aria-label={`Breakdown of ${reviews.count} written reviews`}>
                    {reviews.histogram.map((n, i) => {
                      const pct = Math.round((n / reviews.count) * 100);
                      return (
                        <li key={i}>
                          <span>{5 - i} star</span>
                          <span className="pd-bar" role="img" aria-label={`${pct}% of reviews have ${5 - i} stars`}>
                            <i style={{ width: `${pct}%` }} />
                          </span>
                          <span>{pct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <div className="pd-rev-write">
                  <h3>Review this product</h3>
                  <p>Bought it? Share your thoughts with other shoppers from your orders.</p>
                  <Link className="btn btn-ghost" href="/account/orders" prefetch={false}>
                    Write a product review
                  </Link>
                </div>
              </div>
              <div className="pd-rev-main">
                <h3 className="pd-rv-title">{reviews.count ? `Top reviews from India · ${reviews.count} written review${reviews.count === 1 ? "" : "s"}` : "Top reviews from India"}</h3>
                {reviews.reviews.length ? (
                  <div className="pd-rv-list">
                    {reviews.reviews.map((r, i) => (
                      <article key={r.id} className="pd-rv">
                        <div className="pd-rv-who">
                          <span className="pd-av" style={{ "--c": AVATARS[(r.authorName.length + i) % AVATARS.length] } as React.CSSProperties} aria-hidden="true">
                            {r.authorName
                              .split(/\s+/)
                              .map((s) => s[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <b>{r.authorName}</b>
                        </div>
                        <div className="pd-rv-head">
                          <Stars rating={r.rating} />
                          {r.title ? <h4>{r.title}</h4> : null}
                        </div>
                        <p className="pd-rv-meta">
                          Reviewed in India on {dateIN(r.createdAt)}
                          {r.city ? ` · ${r.city}` : ""}
                        </p>
                        <p className="pd-rv-tags">
                          {p.size ? <>Size: {p.size}</> : null}
                          {r.verified ? (
                            <>
                              {p.size ? <span className="pd-sep" aria-hidden="true" /> : null}
                              <span className="pd-vp">
                                <Icon name="check" />
                                Verified Purchase
                              </span>
                            </>
                          ) : null}
                        </p>
                        <p className="pd-rv-b">{r.body}</p>
                        <HelpfulButton reviewId={r.id} initial={r.helpful} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="pd-rv-none">No written reviews yet. Shoppers who buy this product can review it from their orders.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      <QuickBuyBars title={title} rankLabel={rankLabel} />
    </PdpProvider>
  );
}

function Compare({ items }: { items: ProductCardData[] }) {
  const low = Math.min(...items.map((x) => x.price));
  const top = Math.max(...items.map((x) => x.rating));
  const topCount = items.filter((x) => x.rating === top).length;
  return (
    <section className="pd-cmp blk" aria-labelledby="pd-cmp-h">
      <div className="pd-sec-h">
        <div className="pd-sec-t">
          <h2 id="pd-cmp-h">Compare with similar items</h2>
        </div>
      </div>
      <div className="pd-cmp-scroll" tabIndex={0} role="region" aria-labelledby="pd-cmp-h">
        <table className="pd-cmp-t">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Feature</span>
              </th>
              {items.map((x, i) => (
                <th key={x.id} scope="col" className={i === 0 ? "pd-cur" : undefined}>
                  <span className="pd-cmp-flag">{i === 0 ? "This item" : " "}</span>
                  <Link className="pd-cmp-img" href={`/p/${x.slug}`} style={tintVar(x)} tabIndex={-1} aria-hidden="true" prefetch={false}>
                    <Art product={x} sizes="132px" />
                  </Link>
                  <Link className="pd-cmp-name" href={`/p/${x.slug}`} prefetch={false}>
                    {brandLabel(x)} {x.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="pd-cmp-cta">
              <th scope="row">
                <span className="sr-only">Add to cart</span>
              </th>
              {items.map((x, i) => (
                <td key={x.id} className={i === 0 ? "pd-cur" : undefined}>
                  <AddToCartButton productId={x.id} productName={x.name} outOfStock={x.stock <= 0} className="btn btn-cart btn-sm" />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Customer rating</th>
              {items.map((x, i) => (
                <td key={x.id} className={i === 0 ? "pd-cur" : undefined}>
                  {x.reviewCount ? (
                    <span className="pd-cmp-rate">
                      <Stars rating={x.rating} />
                      <b>{x.rating.toFixed(1)}</b>
                      <small>({x.reviewCount.toLocaleString("en-IN")})</small>
                    </span>
                  ) : (
                    "New"
                  )}
                  {x.reviewCount && x.rating === top && topCount < items.length ? <em className="pd-cmp-tag">Highest rated</em> : null}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Price</th>
              {items.map((x, i) => (
                <td key={x.id} className={i === 0 ? "pd-cur" : undefined}>
                  <b className="pd-cmp-pr">{formatINR(x.price)}</b>
                  {x.mrp > x.price ? <s> {formatINR(x.mrp)}</s> : null}
                  {x.price === low && items.filter((y) => y.price === low).length < items.length ? <em className="pd-cmp-tag pd-cmp-tag-g">Lowest price</em> : null}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Size</th>
              {items.map((x, i) => (
                <td key={x.id} className={i === 0 ? "pd-cur" : undefined}>
                  {x.size ?? "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Brand</th>
              {items.map((x, i) => (
                <td key={x.id} className={i === 0 ? "pd-cur" : undefined}>
                  <Link href={`/brand/${x.brand.slug}`} className="pd-cmp-brand" prefetch={false}>
                    {brandLabel(x)}
                  </Link>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Free TBB gift</th>
              {items.map((x, i) => (
                <td key={x.id} className={i === 0 ? "pd-cur" : undefined}>
                  <span className="pd-yes">
                    <Icon name="check" />
                    Included
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProductSkeleton() {
  return (
    <div className="pd-page" aria-busy="true" aria-label="Loading product">
      <div className="wrap">
        <div className="ct-sk pd-sk-crumb" />
        <section className="pd-top">
          <div className="pd-main blk">
            <div className="ct-sk pd-sk-gal" />
            <div className="pd-sk-info">
              <div className="ct-sk" style={{ height: 18, width: "40%" }} />
              <div className="ct-sk" style={{ height: 64 }} />
              <div className="ct-sk" style={{ height: 20, width: "60%" }} />
              <div className="ct-sk" style={{ height: 48, width: "50%" }} />
              <div className="ct-sk" style={{ height: 120 }} />
            </div>
          </div>
          <aside className="pd-side">
            <div className="ct-sk pd-sk-box" />
          </aside>
        </section>
      </div>
    </div>
  );
}
