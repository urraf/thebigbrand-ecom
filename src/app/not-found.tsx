import Link from "next/link";
import { LostArt } from "@/components/ui/lost-art";

export const metadata = { title: "Page not found" };

/** Last-resort 404 for URLs outside the store / seller / admin areas (no area chrome available here). */
export default function RootNotFound() {
  return (
    <main className="nf-root">
      <div className="nf-root-card">
        <Link href="/" className="nf-logo" aria-label="The Big Brands — home">
          <i>tbb</i>
          <span>
            thebigbrands<em>.co.in</em>
          </span>
        </Link>
        <LostArt />
        <h1>This page went missing</h1>
        <p>The link may be broken or the page may have moved. Let&apos;s get you back to the good stuff.</p>
        <div className="nf-row">
          <Link href="/" className="btn btn-cart">
            Back to home
          </Link>
          <Link href="/help" className="btn btn-ghost">
            Help centre
          </Link>
        </div>
      </div>
    </main>
  );
}
