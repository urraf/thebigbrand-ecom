import Link from "next/link";
import { Icon } from "@/components/ui/icon";

const POPULAR = ["vitamin c serum", "onion hair oil", "sunscreen spf 50", "beard oil", "kajal"];

/** 404 inside the store chrome (rendered when a store page calls notFound()). */
export default function StoreNotFound() {
  return (
    <section className="wrap st-msg">
      <div className="st-msg-card">
        <span className="st-msg-ic">
          <Icon name="search" />
        </span>
        <h1>We couldn’t find that page</h1>
        <p>The product may have sold out, moved or the link might be mistyped. Try a search — every order still comes with a free TBB gift.</p>
        <div className="st-msg-actions">
          <Link href="/" className="btn btn-cart">
            Back to home
          </Link>
          <Link href="/deals" className="btn btn-ghost">
            <Icon name="zap" /> Today’s Deals
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
