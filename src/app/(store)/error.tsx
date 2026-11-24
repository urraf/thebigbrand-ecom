"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/ui/icon";

/** Error boundary for store pages (keeps the header/footer so shoppers can carry on). */
export default function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[store] page error", error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <section className="wrap st-msg">
      <div className="st-msg-card">
        <span className="st-msg-ic">
          <Icon name="info" />
        </span>
        <h1>Something went wrong on our side</h1>
        <p>Sorry about that — your cart is safe. Please try again, or head back to the home page.</p>
        <div className="st-msg-actions">
          <button type="button" className="btn btn-cart" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Back to home
          </Link>
        </div>
        {digest ? <code>Reference: {digest}</code> : null}
      </div>
    </section>
  );
}
