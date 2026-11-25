import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { LostArt } from "@/components/ui/lost-art";

const POPULAR = ["vitamin c serum", "onion hair oil", "sunscreen spf 50", "beard oil", "kajal"];

/** 404 inside the store chrome (unknown URLs via the [...missing] catch-all, and pages that call notFound()). */
export default function StoreNotFound() {
  return (
    <section className="wrap st-msg">
      <div className="st-msg-card nf-card">
        <LostArt />
        <h1>Oops — this page went missing</h1>
        <p>The product may have sold out or moved, or the link might be mistyped. Search for it below — every order still comes with a free TBB gift.</p>
        <form action="/s" method="get" className="nf-search" role="search">
          <Icon name="search" />
          <input type="search" name="q" placeholder="Search brands, products & concerns" aria-label="Search the store" />
          <button type="submit" className="btn btn-cart">
            Search
          </button>
        </form>
        <div className="st-msg-actions">
          <Link href="/" className="btn btn-ghost">
            <Icon name="home" /> Back to home
          </Link>
          <Link href="/deals" className="btn btn-ghost">
            <Icon name="zap" /> Today’s Deals
          </Link>
          <Link href="/help" className="btn btn-ghost">
            <Icon name="info" /> Help centre
          </Link>
        </div>
        <div className="st-msg-links" aria-label="Popular searches">
          {POPULAR.map((q) => (
            <Link key={q} href={`/s?q=${encodeURIComponent(q)}`} className="chip" prefetch={false}>
              <Icon name="trending" /> {q}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
