import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { AdZone, HouseTag, SpLabel } from "@/components/ads";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";
import { ProductCard } from "@/components/ui/product-card";
import { PzBadge, PzSlot } from "@/components/ui/pz-slot";
import { Rail } from "@/components/ui/rail";
import { cx, lum, safeColor, shade } from "@/components/ui/cx";
import { formatINR } from "@/lib/money";
import { getZoneSlot } from "@/server/ads/slots";
import { BRAND_TABS, getBrandStore, type BrandStoreTab } from "@/server/catalog/brands";
import type { BrandInfo } from "@/server/catalog/data";
import { couponValidity, getLiveCoupons, type CouponOffer } from "@/server/catalog/offers";
import { Art, tintVar } from "@/components/catalog/visual";
import { ClipCoupon, CopyCode } from "@/components/catalog/product/pdp-client";
import { BrandFollow } from "./brands-client";

const plural = (n: number, w: string) => `${n.toLocaleString("en-IN")} ${w}${n === 1 ? "" : "s"}`;

function heroTheme(b: BrandInfo): { bg: string; ac: string } {
  if (b.isOwn) return { bg: "radial-gradient(60% 90% at 85% 30%, rgba(255,243,196,.55), transparent 60%), linear-gradient(120deg, #e8245a 0%, #ff3d6e 40%, #ff7a45 100%)", ac: "#fff3c4" };
  const c = safeColor(b.color, "#33195a");
  if (lum(c) < 0.15) {
    const ac = b.accent && lum(safeColor(b.accent, "#d9d9de")) < 0.85 ? safeColor(b.accent, "#d9d9de") : "#d9d9de";
    return { bg: `linear-gradient(120deg, #0a0a0c 0%, #1c1c21 55%, #2c2c33 100%)`, ac };
  }
  return { bg: `linear-gradient(120deg, ${shade(c, -0.55)} 0%, ${shade(c, -0.15)} 50%, ${c} 100%)`, ac: shade(c, 0.8) };
}

function couponValue(c: CouponOffer) {
  return c.type === "PERCENT" ? `${c.value}% off` : c.type === "FLAT" ? `${formatINR(c.value)} off` : "Buy 1 Get 1";
}

/**
 * Brand store hero (B1 — the paid brand store). Paid stores get the full banner hero (Brand.bannerUrl + wordmark
 * + tagline + follow + stats) inside the B1 placement wrapper; the client's own label presents as "TBB Originals"
 * (house); brands without a store subscription get the basic header.
 */
export async function BrandHero({ slug }: { slug: string }) {
  const [store, b1] = await Promise.all([getBrandStore(slug), getZoneSlot("B1")]);
  if (!store) notFound();
  const b = store.brand;
  const name = b.displayName;
  const paid = b.isOwn || (b.storeActive && Boolean(b1?.isActive));
  if (!paid) {
    return (
      <section className="sr-bbasic">
        <span className="sr-bbasic-logo" style={{ "--ba": b.accent || "#f4f3f8" } as CSSProperties}>
          <BrandLogo brand={b} size={22} />
        </span>
        <div className="sr-bbasic-t">
          <nav className="sr-crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <Icon name="chevRight" />
            <Link href="/brands">Brand stores</Link>
            <Icon name="chevRight" />
            <span aria-current="page">{name}</span>
          </nav>
          <h1>{name}</h1>
          <p>
            {b.tagline ? <>{b.tagline} · </> : null}
            {b.avgRating ? (
              <>
                <Icon name="star" />
                {b.avgRating.toFixed(1)} ·{" "}
              </>
            ) : null}
            {plural(b.productCount, "product")}
          </p>
        </div>
        <BrandFollow slug={b.slug} name={name} followers={b.followers} avg={b.avgRating} products={b.productCount} basic />
      </section>
    );
  }
  const th = heroTheme(b);
  const arts = [...store.products].sort((x, y) => Number(!!y.image) - Number(!!x.image) || y.soldCount - x.soldCount).slice(0, 3);
  const hero = (
    <section className={cx("sr-bh", b.isOwn && "is-own", b.bannerUrl && "has-photo")} style={{ "--bh-bg": th.bg, "--bh-ac": th.ac } as CSSProperties}>
      {b.bannerUrl ? (
        <span className="sr-bh-photo" aria-hidden="true">
          <Image src={b.bannerUrl} alt="" fill sizes="(max-width: 960px) 100vw, 1400px" loading="eager" fetchPriority="high" />
        </span>
      ) : null}
      <div className="sr-bh-lbl">
        {b.isOwn ? (
          <HouseTag text="Our own label" />
        ) : (
          <>
            <PzBadge />
            <span>Sponsored brand store</span>
          </>
        )}
      </div>
      <div className="sr-bh-copy">
        <nav className="sr-crumb sr-crumb-l" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <Icon name="chevRight" />
          <Link href="/brands">Brand stores</Link>
          <Icon name="chevRight" />
          <span aria-current="page">{name}</span>
        </nav>
        <h1 className="sr-bh-word">
          {b.isOwn ? (
            <span className="sr-bh-own">
              TBB <em>Originals</em>
            </span>
          ) : (
            <BrandLogo brand={b} size={58} color="#ffffff" />
          )}
          <span className="sr-only">{name}</span>
        </h1>
        {b.tagline ? <p className="sr-bh-tl">{b.tagline}</p> : null}
        <div className="sr-bh-ver">
          <Icon name="shield" />
          <span>{b.isOwn ? "Made by The Big Brands · free in every order" : "Official store · 100% authentic · sourced direct"}</span>
        </div>
        <BrandFollow slug={b.slug} name={name} followers={b.followers} avg={b.avgRating} products={b.productCount} />
      </div>
      <div className="sr-bh-art" data-n={arts.length} aria-hidden="true">
        {arts.map((p, i) => (
          <span key={p.id} className={`a${i}`} style={tintVar(p)}>
            <Art product={p} sizes="150px" priority={i === 0} />
          </span>
        ))}
      </div>
    </section>
  );
  if (b.isOwn || !b1) return hero;
  return (
    <PzSlot slot={b1} className="sr-bh-slot">
      {hero}
    </PzSlot>
  );
}

/** Tabs, coupons, concern chips, product grid and the "Sponsored · similar brands" rail (reads ?tab=). */
export async function BrandBody({ slug, tab }: { slug: string; tab: BrandStoreTab }) {
  const [store, coupons, h7] = await Promise.all([getBrandStore(slug, tab), getLiveCoupons(), getZoneSlot("H7")]);
  if (!store) notFound();
  const b = store.brand;
  const name = b.displayName;
  const mine = coupons.filter((c) => c.brandSlug === b.slug).slice(0, 2);
  const tabLabel = BRAND_TABS.find(([k]) => k === tab)?.[1] ?? "All products";
  const n = store.products.length;
  return (
    <>
      <AdZone code="B1" context={{ brandSlug: b.slug }} />
      <div className="sr-snav">
        <nav className="sr-tabs" aria-label={`${name} products`}>
          {BRAND_TABS.map(([k, l]) => (
            <Link key={k} className={cx("sr-tab", tab === k && "on")} aria-current={tab === k ? "page" : undefined} href={k === "all" ? `/brand/${b.slug}` : `/brand/${b.slug}?tab=${k}`} scroll={false} replace>
              {l}
            </Link>
          ))}
        </nav>
        {b.isOwn ? null : (
          <Link className="sr-claim-store" href="/advertise">
            <Icon name="store" />
            {b.storeActive ? "Advertise next to this store" : "Is this your brand? Get a brand store"}
          </Link>
        )}
      </div>
      {b.isOwn ? (
        <div className="sr-ownnote">
          <span className="sr-ownnote-ic">
            <Icon name="gift" />
          </span>
          <div>
            <b>Try any of these free first.</b>
            <span>Every order on The Big Brands includes a TBB Originals mini — you pick it at checkout, before payment.</span>
          </div>
          <Link className="btn btn-cart btn-sm" href="/gifts">
            How free gifts work <Icon name="arrow" />
          </Link>
        </div>
      ) : null}
      {mine.length || store.concerns.length ? (
        <div className="sr-binfo">
          {mine.map((c) => (
            <div key={c.id} className="sr-coupon">
              <div className="sr-cp-v">
                <b>{couponValue(c)}</b>
                <small>{c.minOrder ? `on ${formatINR(c.minOrder)}+` : "no minimum"}</small>
              </div>
              <div className="sr-cp-m">
                <span className="sr-cp-lbl">{c.isSponsored ? <SpLabel text="Brand coupon" /> : <span>Store coupon</span>}</span>
                <b>{c.title}</b>
                <small>
                  {couponValidity(c) ? `Valid till ${couponValidity(c)} · ` : ""}
                  {c.isSponsored ? "clip it and it applies automatically at checkout" : `use code ${c.code} at checkout`}
                </small>
              </div>
              {c.isSponsored ? <ClipCoupon couponId={c.id} label={`${name} coupon`} className="btn btn-sm btn-cart sr-clip" /> : <CopyCode code={c.code} />}
            </div>
          ))}
          {store.concerns.length ? (
            <div className="sr-bconc">
              <b>Shop {name} by concern</b>
              <div>
                {store.concerns.map((c) => (
                  <Link key={c.slug} className="sr-cchip" href={`/s?brand=${b.slug}&concern=${c.slug}`} prefetch={false}>
                    {c.emoji ? <span aria-hidden="true">{c.emoji}</span> : null} {c.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <section className="sr-sec" aria-labelledby="sr-bprod">
        <div className="sr-sech">
          <h2 id="sr-bprod">
            {tabLabel} <span className="sr-count-n">{n}</span>
          </h2>
        </div>
        {n ? (
          <div className={cx("sr-grid", n <= 4 ? "sr-grid-4 sr-grid-few" : n === 6 ? "sr-grid-6" : "sr-grid-5")}>
            {store.products.map((p, i) => {
              const r = store.bestIds.indexOf(p.id);
              return (
                <div key={p.id} className={cx("sr-cell", tab === "best" && r >= 0 && "is-ranked")}>
                  {tab === "best" && r >= 0 ? (
                    <span className="sr-rank">
                      #{r + 1} Bestseller in {name}
                    </span>
                  ) : null}
                  <ProductCard product={p} priority={i < 5} sizes="(max-width: 700px) 46vw, (max-width: 1360px) 24vw, 270px" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="blk sr-nf">
            <p className="muted">No products from {name} are live right now — check back soon.</p>
          </div>
        )}
      </section>
      {store.similar.length ? (
        <div className="sr-sec">
          <PzSlot slot={h7 ?? { code: "H7", name: "Featured brand stores" }} className="sr-sim-slot">
            <section className="blk sr-sim" aria-labelledby="sr-sim-h">
              <div className="blk-h">
                <h2 id="sr-sim-h">Similar brands you may like</h2>
                <SpLabel />
              </div>
              <Rail label="Similar brands" itemWidth="260px" className="sr-simrail">
                {store.similar.map((x) => (
                  <Link key={x.id} className="sr-simt" href={`/brand/${x.slug}`} prefetch={false}>
                    <span className="sr-simt-top" style={{ "--ba": x.accent || "#f4f3f8" } as CSSProperties}>
                      {x.storeActive ? <PzBadge /> : null}
                      <span className="sr-simt-logo">
                        <BrandLogo brand={x} size={x.word && x.word.length > 10 ? 15 : 19} />
                      </span>
                      <span className="sr-simt-arts" aria-hidden="true">
                        {x.top.map((p) => (
                          <span key={p.id}>
                            <Art product={p} sizes="50px" />
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="sr-simt-b">
                      <small>{x.tagline ?? ""}</small>
                      <span>
                        {x.avgRating ? (
                          <>
                            <Icon name="star" />
                            {x.avgRating.toFixed(1)} ·{" "}
                          </>
                        ) : null}
                        {plural(x.productCount, "product")}
                      </span>
                      <b>
                        Visit store <Icon name="arrow" />
                      </b>
                    </span>
                  </Link>
                ))}
              </Rail>
            </section>
          </PzSlot>
        </div>
      ) : null}
    </>
  );
}
