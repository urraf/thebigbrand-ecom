import Link from "next/link";
import { formatINR } from "@/lib/money";
import { HouseTag } from "@/components/ads";
import { Icon } from "@/components/ui/icon";
import { Art } from "@/components/catalog/visual";
import { getOriginals } from "@/server/catalog/home";
import { getStoreSettings } from "@/server/catalog/data";
import { getGiftProgramme } from "@/server/catalog/offers";

/**
 * The client's own house blocks on the homepage (no ad slot): the "free gift with every order" promo that sits
 * next to the H10 sponsored deal, and the TBB Originals banner + trending searches at the end of the page.
 * All reads are cached ('use cache' + tags) so the homepage stays a static shell.
 */

export async function GiftPromo() {
  const { tiers, gifts, worthUpTo } = await getGiftProgramme();
  const minis = gifts.slice(0, 6);
  return (
    <aside className="hm-gift" aria-label="A free gift with every order">
      <span className="hm-gift-fx" aria-hidden="true" />
      <div className="hm-gift-a">
        <div className="hm-gift-top">
          <HouseTag />
          <span className="hm-gift-k">Only on The Big Brands</span>
        </div>
        <h2 className="hm-gift-h">
          A free gift with <em>every</em> order.
        </h2>
        <p>
          Choose your TBB Originals mini before you pay — the bigger the bag, the more you pick
          {worthUpTo ? <>, worth up to {formatINR(worthUpTo)}</> : null}.
        </p>
      </div>
      <div className="hm-gift-b">
        <ol className="hm-tiers">
          {tiers.map((t) => (
            <li key={t.minAmount}>
              <span className="hm-tier-ic" aria-hidden="true">
                {Array.from({ length: Math.max(1, Math.min(3, t.giftCount)) }, (_, i) => (
                  <Icon key={i} name="gift" />
                ))}
              </span>
              <b>
                {t.giftCount} free gift{t.giftCount > 1 ? "s" : ""}
              </b>
              <small>{t.minAmount > 0 ? `on ${formatINR(t.minAmount)}+` : "on any order"}</small>
            </li>
          ))}
        </ol>
        {minis.length ? (
          <div className="hm-minis">
            {minis.map((g) => (
              <Link key={g.id} className="hm-mini" href="/gifts" aria-label={`${g.miniName} mini, worth ${formatINR(g.worth)}`} prefetch={false}>
                <span className="hm-mini-art">
                  <Art product={g.product} sizes="72px" />
                </span>
                <small>worth {formatINR(g.worth)}</small>
              </Link>
            ))}
          </div>
        ) : null}
        <Link className="btn btn-cart btn-lg hm-gift-cta" href="/gifts">
          <Icon name="gift" />
          Explore the Free Gift Store
          <Icon name="arrow" />
        </Link>
      </div>
    </aside>
  );
}

export async function OriginalsBanner() {
  const [originals, settings] = await Promise.all([getOriginals(6), getStoreSettings()]);
  const from = originals.length ? Math.min(...originals.map((p) => p.price)) : 0;
  return (
    <section className="wrap hm-sec" aria-label="TBB Originals">
      {originals.length ? (
        <div className="hm-house">
          <span className="hm-house-fx" aria-hidden="true" />
          <div className="hm-house-copy">
            <HouseTag text="Our own label" />
            <span className="hm-house-logo">
              TBB <em>Originals</em>
            </span>
            <h2 className="hm-house-h">
              Loved your free gift? <span>Get the full size.</span>
            </h2>
            <p>The minis you picked at checkout — now in full size, from {formatINR(from)}. Made in India, dermatologically tested.</p>
            <Link className="hm-cta" href="/gifts">
              Shop TBB Originals
              <Icon name="arrow" />
            </Link>
          </div>
          <div className="hm-house-row">
            <span className="hm-house-note" aria-hidden="true">
              your favourite minis, now full size!
              <svg viewBox="0 0 60 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 6c18 2 34 10 44 26" />
                <path d="M38 30l10 3 2-11" />
              </svg>
            </span>
            {originals.map((p) => (
              <Link key={p.id} className="hm-house-p" href={`/p/${p.slug}`} prefetch={false}>
                <span className="hm-house-art">
                  <Art product={p} sizes="120px" />
                </span>
                <b>{p.art.line || p.name}</b>
                <small>
                  {formatINR(p.price)}
                  {p.size ? ` · ${p.size}` : ""}
                </small>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {settings.trending.length ? (
        <div className="hm-trend">
          <span className="hm-trend-l">
            <Icon name="trending" />
            Trending searches
          </span>
          <div className="hm-trend-chips">
            {settings.trending.map((t) => (
              <Link key={t} className="chip" href={`/s?q=${encodeURIComponent(t)}`} prefetch={false}>
                <Icon name="search" />
                {t}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
