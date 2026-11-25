import Image from "next/image";
import Link from "next/link";
import { AdZone } from "@/components/ads";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { Art, tintVar } from "@/components/catalog/visual";
import type { CategoryHead, ConcernHead, DealsHead } from "@/server/catalog/pages";
import { DealsCountdown } from "./countdown";
import type { SearchState } from "../search-state";

const plural = (n: number, w: string) => `${n.toLocaleString("en-IN")} ${w}${n === 1 ? "" : "s"}`;

/** /c/<slug> header: name, counts, concern chips, brands in the category, lifestyle photo + product fan. */
export function CategoryHeader({ head, state }: { head: CategoryHead; state: SearchState }) {
  const c = head.category;
  return (
    <section className="wrap">
      <div className={cx("sr-cathead", c.imageUrl && "has-photo")}>
        {c.imageUrl ? (
          <span className="sr-cathead-photo" aria-hidden="true">
            <Image src={c.imageUrl} alt="" fill sizes="(max-width: 960px) 100vw, 640px" loading="eager" fetchPriority="high" />
          </span>
        ) : null}
        <div className="sr-cathead-copy">
          <nav className="ct-crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <Icon name="chevRight" />
            <span aria-current="page">{c.name}</span>
          </nav>
          <h1>{c.name}</h1>
          <p>
            {plural(head.productCount, "product")} from {plural(head.brands.length, "brand")} · every order ships with a free TBB mini
          </p>
          {head.concerns.length ? (
            <div className="sr-cathead-chips" aria-label={`Shop ${c.name} by concern`}>
              {head.concerns.map((cn) => {
                const on = state.concerns.length === 1 && state.concerns[0] === cn.slug;
                return (
                  <Link key={cn.slug} className={cx("sr-cchip", on && "on")} href={on ? `/c/${c.slug}` : `/c/${c.slug}?concern=${cn.slug}`} aria-current={on || undefined} scroll={false}>
                    {cn.emoji ? <span aria-hidden="true">{cn.emoji}</span> : null} {cn.name}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
        {head.brands.length ? (
          <div className="sr-cathead-brands" aria-label={`Brands in ${c.name}`}>
            {head.brands.slice(0, 6).map((b) => (
              <Link key={b.id} href={`/brand/${b.slug}`} className="sr-cbrand" aria-label={`${b.displayName} store`} prefetch={false}>
                <BrandLogo brand={b} size={14} showSub={false} />
              </Link>
            ))}
          </div>
        ) : null}
        <div className="sr-cathead-art" data-n={head.arts.length} aria-hidden="true">
          {head.arts.map((p, i) => (
            <span key={p.id} className={`a${i}`} style={tintVar(p)}>
              <Art product={p} sizes="130px" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Concern landing (/s?concern=acne): the concern's sponsor gets a "Presented by" credit (H4). */
export function ConcernHeader({ head }: { head: ConcernHead }) {
  const cn = head.concern;
  return (
    <section className="wrap">
      <div className="sr-cathead sr-conhead">
        <div className="sr-cathead-copy">
          <nav className="ct-crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <Icon name="chevRight" />
            <span>Shop by concern</span>
            <Icon name="chevRight" />
            <span aria-current="page">{cn.name}</span>
          </nav>
          <div className="sr-conhead-t">
            {cn.emoji ? (
              <span className="sr-con-emo" aria-hidden="true">
                {cn.emoji}
              </span>
            ) : null}
            <h1>{cn.name}</h1>
            <AdZone code="H4" context={{ concern: cn.slug }} />
          </div>
          <p>
            {plural(head.productCount, "product")} from {plural(head.brandCount, "brand")}, hand-picked for {cn.name.toLowerCase()} · a free TBB mini in every order
          </p>
          <div className="sr-cathead-chips" aria-label="Other concerns">
            {head.others.map((c) => (
              <Link key={c.slug} className="sr-cchip" href={`/s?concern=${c.slug}`} prefetch={false}>
                {c.emoji ? <span aria-hidden="true">{c.emoji}</span> : null} {c.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="sr-cathead-art" data-n={head.arts.length} aria-hidden="true">
          {head.arts.map((p, i) => (
            <span key={p.id} className={`a${i}`} style={tintVar(p)}>
              <Art product={p} sizes="130px" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** /deals header: "Up to X% off", countdown to midnight, hero fan, quick deal chips. */
export function DealsHeader({ head, state }: { head: DealsHead; state: SearchState }) {
  const plain = !state.cat && !state.max && !state.discount && !state.brands.length && !state.concerns.length && !state.min;
  const chips: [string, string, boolean][] = [
    ["All deals", "/deals", plain],
    ["Under ₹299", "/deals?max=299", state.max === 299 && !state.min && !state.cat],
    ["25% off & more", "/deals?discount=25", state.discount === 25 && !state.cat],
    ...head.categories.map((c): [string, string, boolean] => [c.short, `/deals?cat=${c.slug}`, state.cat === c.slug && state.brands.length === 0]),
    ...(head.hasOwn ? [["TBB Originals", "/deals?brand=tbb", state.brands.length === 1 && state.brands[0] === "tbb"] as [string, string, boolean]] : []),
  ];
  return (
    <section className="wrap">
      <div className="sr-dealhero">
        <div className="sr-dh-copy">
          <span className="sr-dh-k">
            <Icon name="zap" /> Today&rsquo;s Deals
          </span>
          <h1>Up to {head.maxOff}% off India&rsquo;s favourite beauty brands</h1>
          <p>{plural(head.count, "deal")} live now · new deals drop at midnight · a free TBB gift in every box</p>
        </div>
        <div className="sr-dh-cd" role="timer" aria-label="Today's deals end at midnight">
          <small>Deals end in</small>
          <DealsCountdown />
        </div>
        <div className="sr-dh-art" aria-hidden="true">
          {head.arts.map((p, i) => (
            <span key={p.id} className={`a${i}`} style={tintVar(p)}>
              <Art product={p} sizes="110px" />
              <em>-{p.off}%</em>
            </span>
          ))}
        </div>
        <nav className="sr-dchips" aria-label="Deal types">
          {chips.map(([l, href, on]) => (
            <Link key={href} className={cx("sr-dchip", on && "on")} href={href} aria-current={on || undefined} scroll={false}>
              {l}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
