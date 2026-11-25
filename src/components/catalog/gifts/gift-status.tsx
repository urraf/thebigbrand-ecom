"use client";
import Link from "next/link";
import type { GiftTierLite } from "@/types/shared";
import { useCart } from "@/components/cart/cart-context";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { formatINR } from "@/lib/money";

/** Live free-gift progress for this shopper's cart (Free Gift Store tier card). */
export function GiftStatus({ tiers }: { tiers: GiftTierLite[] }) {
  const { cart, ready } = useCart();
  const sub = cart?.subtotal ?? 0;
  const allow = tiers.reduce((n, t) => (sub >= t.minAmount ? Math.max(n, t.giftCount) : n), 0);
  const next = tiers.filter((t) => t.minAmount > sub).sort((a, b) => a.minAmount - b.minAmount)[0];
  const top = Math.max(1, ...tiers.map((t) => t.minAmount));
  const pct = Math.min(100, (sub / top) * 100);
  const g = (n: number) => `${n} free gift${n === 1 ? "" : "s"}`;
  return (
    <div className="sr-gstat" aria-live="polite">
      <div className="sr-gstat-t">
        <Icon name="gift" />
        <span>
          {!ready ? (
            "Checking your cart…"
          ) : !sub ? (
            "Your cart is empty — add any product to unlock your first free gift."
          ) : next ? (
            <>
              You&rsquo;ve unlocked <b>{g(allow)}</b>. Add <b>{formatINR(next.minAmount - sub)}</b> more to unlock {next.giftCount}.
            </>
          ) : (
            <>
              Brilliant — you&rsquo;ve unlocked the maximum <b>{g(allow)}</b>.
            </>
          )}
        </span>
        {sub ? (
          <Link href="/cart" className="sr-gstat-l">
            Cart · {formatINR(sub)}
          </Link>
        ) : null}
      </div>
      <div className="sr-gbar">
        <span style={{ width: `${pct}%` }} />
        {tiers
          .filter((t) => t.minAmount > 0)
          .map((t) => (
            <i key={t.minAmount} style={{ left: `${(t.minAmount / top) * 100}%` }} className={cx(sub >= t.minAmount && "on")}>
              <em>{formatINR(t.minAmount)}</em>
            </i>
          ))}
      </div>
    </div>
  );
}

/** Highlights the tiers this cart has reached. */
export function TierItem({ tier, last, children }: { tier: GiftTierLite; last: boolean; children: React.ReactNode }) {
  const { cart } = useCart();
  const on = (cart?.subtotal ?? 0) >= tier.minAmount && (tier.minAmount > 0 || (cart?.count ?? 0) > 0);
  return (
    <li className={cx(on && "is-on")}>
      {children}
      {!last ? (
        <span className="sr-tier-arrow" aria-hidden="true">
          <Icon name="chevRight" />
        </span>
      ) : null}
    </li>
  );
}
