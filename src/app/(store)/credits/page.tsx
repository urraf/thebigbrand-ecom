import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { getCredits, type Credit } from "@/server/catalog/credits";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/pages.css";

export const metadata: Metadata = {
  title: "Image credits",
  description: "Credits and licences for the product and lifestyle photography used on The Big Brands.",
  alternates: { canonical: "/credits" },
};

function Row({ c }: { c: Credit }) {
  return (
    <li className="cr-row">
      <span className="cr-thumb">
        <Image src={c.url} alt="" fill sizes="64px" />
      </span>
      <div className="cr-meta">
        <b>{c.sourceUrl ? <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{c.title || c.alt}</a> : c.title || c.alt}</b>
        <span>
          by {c.creator || "unknown"} · {c.source}
          {" · "}
          {c.licenseUrl ? (
            <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer license">
              {c.license}
            </a>
          ) : (
            c.license
          )}{" "}
          · <i>modified</i>
        </span>
        {c.usedFor.length ? <small>Used for: {c.usedFor.join(" · ")}</small> : null}
      </div>
    </li>
  );
}

/** /credits — attribution for every CC-licensed image (CC BY / BY-SA require it, with licence links and a "modified" note). */
export default function CreditsPage() {
  const d = getCredits();
  return (
    <div className="pg-page wrap">
      <nav className="ct-crumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chevRight" />
        <span aria-current="page">Image credits</span>
      </nav>
      <header className="pg-head blk">
        <h1>Image credits</h1>
        <p>
          The Big Brands uses {d.total} openly licensed photographs. We thank every photographer and contributor. Each image below lists its creator, source and licence;
          all of them were modified for use on this site as described.
        </p>
        <ul className="cr-lic">
          {d.licenses.map((l) => (
            <li key={l.name}>
              {l.url ? (
                <a href={l.url} target="_blank" rel="noopener noreferrer license">
                  {l.name}
                </a>
              ) : (
                l.name
              )}{" "}
              <span>× {l.count}</span>
            </li>
          ))}
        </ul>
        <p className="cr-src">
          Sources:{" "}
          {d.sources.map((s, i) => (
            <span key={s.name}>
              {i ? ", " : ""}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              ) : (
                s.name
              )}
            </span>
          ))}
          . Brand names and logos belong to their owners and are used only to identify their products.
        </p>
      </header>
      <section className="blk pg-sec" aria-labelledby="cr-p">
        <h2 id="cr-p">
          Product photos <span className="cr-n">{d.product.length}</span>
        </h2>
        {d.modifications.product ? <p className="cr-mod"><b>Changes made:</b> {d.modifications.product}</p> : null}
        <ul className="cr-list">
          {d.product.map((c) => (
            <Row key={c.url} c={c} />
          ))}
        </ul>
      </section>
      <section className="blk pg-sec" aria-labelledby="cr-l">
        <h2 id="cr-l">
          Lifestyle &amp; campaign photos <span className="cr-n">{d.lifestyle.length}</span>
        </h2>
        {d.modifications.lifestyle ? <p className="cr-mod"><b>Changes made:</b> {d.modifications.lifestyle}</p> : null}
        <ul className="cr-list">
          {d.lifestyle.map((c) => (
            <Row key={c.url} c={c} />
          ))}
        </ul>
      </section>
      <p className="pg-note muted">
        Spotted a problem with an attribution? Write to <a href="mailto:care@thebigbrands.co.in">care@thebigbrands.co.in</a> and we&rsquo;ll fix it within 48 hours.
      </p>
    </div>
  );
}
