import type { Metadata } from "next";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { brandLiteSelect, productCardSelect, toBrandLite, toProductCard } from "@/server/catalog/cards";
import type { ProductCardData } from "@/types/shared";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { WishButton } from "@/components/cart/wish-button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon, ICON_NAMES } from "@/components/ui/icon";
import { Packshot } from "@/components/ui/packshot";
import { Price } from "@/components/ui/price";
import { ProductCard } from "@/components/ui/product-card";
import { ProductImage } from "@/components/ui/product-image";
import { PzBadge, PzSlot } from "@/components/ui/pz-slot";
import { Rail } from "@/components/ui/rail";
import { Stars } from "@/components/ui/stars";
import { KitDemo } from "@/components/store/kit-demo";
import "@/styles/store/kit.css";

export const metadata: Metadata = {
  title: "UI kit",
  description: "The Big Brands store UI kit — every shared component rendered with live catalogue data.",
  robots: { index: false, follow: false },
};

const SHAPES = ["bottle", "tube", "dropper", "jar", "pump", "stick"] as const;

async function getKitData() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.brands);
  const [rows, brands] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ isFeatured: "desc" }, { soldCount: "desc" }],
      take: 60,
      select: productCardSelect,
    }),
    db.brand.findMany({ orderBy: [{ isOwn: "asc" }, { sortOrder: "asc" }, { name: "asc" }], select: brandLiteSelect }),
  ]);
  const products = rows.map(toProductCard);
  return { products, brands: brands.map(toBrandLite), sample: await findSamplePhoto(products) };
}

/**
 * A real photo from public/media/products/<brand>/ (demos the photo path before the DB has ProductImage rows).
 * Prefers the file named after the product's own slug; never picks the first card (it's shown as a packshot).
 */
async function findSamplePhoto(products: ProductCardData[]): Promise<{ productId: string; url: string } | null> {
  try {
    const root = path.join(process.cwd(), "public", "media", "products");
    const dirs = new Set((await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name));
    const isPhoto = (f: string) => /\.(webp|jpe?g|png|avif)$/i.test(f);
    const files = new Map<string, string[]>();
    const list = async (brand: string) => {
      if (!files.has(brand)) files.set(brand, (await readdir(path.join(root, brand))).filter(isPhoto));
      return files.get(brand)!;
    };
    const candidates = products.slice(1).filter((p) => dirs.has(p.brand.slug));
    for (const p of candidates) {
      const own = (await list(p.brand.slug)).find((f) => f.replace(/\.[a-z]+$/i, "") === p.slug);
      if (own) return { productId: p.id, url: `/media/products/${p.brand.slug}/${own}` };
    }
    for (const p of candidates) {
      const any = (await list(p.brand.slug))[0];
      if (any) return { productId: p.id, url: `/media/products/${p.brand.slug}/${any}` };
    }
  } catch {
    /* no media yet */
  }
  return null;
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="blk kit-sec" aria-labelledby={`${id}-h`}>
      <div className="blk-h">
        <h2 id={`${id}-h`}>{title}</h2>
        {note ? <span className="kit-note">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default async function KitPage() {
  const { products, brands, sample } = await getKitData();
  const dbPhoto = products.find((p) => p.image);
  const sampleOf = sample ? products.find((p) => p.id === sample.productId) : undefined;
  const withPhoto: ProductCardData | undefined =
    dbPhoto ?? (sample && sampleOf ? { ...sampleOf, image: { url: sample.url, alt: `${sampleOf.brand.name} product photo`, width: null, height: null } } : undefined);
  const own = products.find((p) => p.isOwnLabel);
  const lowStock = products.find((p) => p.stock > 0 && p.stock <= 5);
  const first = products[0] ?? null;
  const soldOut: ProductCardData | null = first ? { ...first, id: `${first.id}`, stock: 0 } : null;
  const byShape = SHAPES.map((s) => products.find((p) => p.art.shape === s)).filter((p): p is ProductCardData => Boolean(p));
  const grid = products.slice(0, 10);
  const s1 = { code: "S3", name: "Sponsored Products", size: "Card", rateLabel: "₹5 CPC" };

  return (
    <div className="wrap kit">
      <header className="kit-hero">
        <h1>Store UI kit</h1>
        <p className="muted">
          Every shared component from <code>src/components/ui</code>, <code>src/components/cart</code> and the store chrome, rendered with live
          catalogue data ({products.length} active products, {brands.length} brands). Use the search box above to try suggestions (↑/↓/Enter, sponsored row = slot S1).
        </p>
        <nav className="kit-toc" aria-label="Sections">
          {[
            ["cards", "Product cards"],
            ["rail", "Rail"],
            ["interactive", "Interactive"],
            ["images", "Images & packshots"],
            ["brands", "Brand logos"],
            ["price", "Price & stars"],
            ["buttons", "Buttons & badges"],
            ["icons", "Icons"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="chip">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="cards" title="ProductCard" note="default · sponsored · slot-wrapped · own label · low stock · sold out · compact">
        <div className="kit-grid">
          {grid.slice(0, 4).map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
          {grid[4] ? <ProductCard product={grid[4]} sponsored slot={s1} /> : null}
          {own ? <ProductCard product={own} /> : null}
          {lowStock ? <ProductCard product={lowStock} /> : null}
          {soldOut ? <ProductCard product={soldOut} /> : null}
          {withPhoto && withPhoto.id !== grid[0]?.id ? <ProductCard product={withPhoto} /> : null}
          {grid[5] ? <ProductCard product={grid[5]} compact /> : null}
        </div>
      </Section>

      <Section id="rail" title="Rail" note="horizontal scroller with arrows (hover on desktop, swipe on phones)">
        <Rail label="Bestsellers">
          {products.slice(0, 14).map((p) => (
            <ProductCard key={p.id} product={p} compact />
          ))}
        </Rail>
      </Section>

      <Section id="interactive" title="Toasts, drawer, dialog & Added-to-cart flyout">
        <KitDemo productId={first?.id ?? null} />
        {first ? (
          <div className="kit-row">
            <AddToCartButton productId={first.id} />
            <AddToCartButton productId={first.id} className="btn btn-buy" label="Add 2 to cart" qty={2} />
            <AddToCartButton productId={first.id} outOfStock />
            <span className="kit-heart">
              <WishButton productId={first.id} productName={first.name} />
            </span>
            <span className="kit-note">Heart: signed-out → toast with Sign in; signed-in → saved to /api/v1/wishlist</span>
          </div>
        ) : null}
      </Section>

      <Section id="images" title="ProductImage & Packshot" note="photo when present, else the SVG packshot from Product.art">
        <div className="kit-shapes">
          {byShape.map((p) => (
            <figure key={p.id}>
              <ProductImage product={p} sizes="140px" />
              <figcaption>
                <b>{p.art.shape}</b>
                {p.brand.name}
              </figcaption>
            </figure>
          ))}
          {withPhoto ? (
            <figure>
              <ProductImage product={withPhoto} sizes="140px" />
              <figcaption>
                <b>photo</b>
                {withPhoto.brand.name}
              </figcaption>
            </figure>
          ) : null}
          {first ? (
            <figure>
              <span className="pimg kit-raw">
                <Packshot art={{ shape: "pump", c1: "#ff3d6e", c2: "#140a24", line: "Kit demo" }} name="Custom" brand={{ name: "The Big Brands", word: "TBB", isOwn: true }} />
              </span>
              <figcaption>
                <b>custom art</b>Packshot props
              </figcaption>
            </figure>
          ) : null}
        </div>
      </Section>

      <Section id="brands" title="BrandLogo" note="wordmarks styled from the Brand row (font, weight, case, tracking)">
        <div className="kit-brands">
          {brands.map((b) => (
            <div key={b.id} className="kit-brand" style={{ background: b.accent ?? "#f7f6fa" }}>
              <BrandLogo brand={b} size={22} />
              <small>{b.slug}</small>
            </div>
          ))}
        </div>
      </Section>

      <Section id="price" title="Price & Stars">
        <div className="kit-row kit-prices">
          <Price price={599} mrp={699} />
          <Price price={1299} mrp={1999} big />
          <Price price={249} />
          <Price price={349} mrp={449} hideMrp />
        </div>
        <div className="kit-row">
          {[5, 4.6, 4.2, 3.5, 2.1, 0].map((r) => (
            <span key={r} className="kit-star">
              <Stars rating={r} /> <small>{r.toFixed(1)}</small>
            </span>
          ))}
        </div>
      </Section>

      <Section id="buttons" title="Buttons, badges & placement wrapper" note="classes from theme.css · pz-* for ad placements">
        <div className="kit-row">
          <button type="button" className="btn btn-cart">btn-cart</button>
          <button type="button" className="btn btn-buy">btn-buy</button>
          <button type="button" className="btn btn-ghost">btn-ghost</button>
          <button type="button" className="btn btn-dark">btn-dark</button>
          <button type="button" className="btn btn-cart btn-sm">btn-sm</button>
          <button type="button" className="btn btn-cart btn-lg">btn-lg</button>
          <button type="button" className="btn btn-cart" disabled>disabled</button>
          <a className="link" href="#buttons">
            Link <Icon name="arrow" />
          </a>
        </div>
        <div className="kit-row">
          <PzBadge />
          <PzBadge label="The Big Brands" />
          <span className="sp-label">
            Sponsored <Icon name="info" />
          </span>
          <span className="chip">chip</span>
          <span className="chip on">chip.on</span>
          <span className="free">FREE</span>
        </div>
        <PzSlot slot={{ code: "H3", name: "Leaderboard Strip", size: "1500×120", rateLabel: "₹2,000/day" }} className="kit-slot">
          <PzBadge /> <span>Any paid placement sits in a <code>.pz-slot</code> — open the menu → “Show / hide ad slots” to outline it.</span>
        </PzSlot>
      </Section>

      <Section id="icons" title="Icon" note={`${ICON_NAMES.length} icons ported from the demo IC map`}>
        <ul className="kit-icons">
          {ICON_NAMES.map((n) => (
            <li key={n}>
              <Icon name={n} />
              <small>{n}</small>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
