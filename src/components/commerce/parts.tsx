/**
 * Small presentational pieces shared by the cart, checkout, order and account pages. No hooks — usable from
 * Server and Client Components.
 */
import type { CSSProperties, ReactNode } from "react";
import { formatINR } from "@/lib/money";
import type { GiftOption, GiftTierLite, ProductCardData } from "@/types/shared";
import { Icon } from "@/components/ui/icon";
import { Packshot } from "@/components/ui/packshot";
import { ProductVisual, productTint } from "@/components/ui/product-image";
import { cx } from "@/components/ui/cx";
import { plural } from "./api";

type ArtLike = { shape: string | null; c1: string | null; c2: string | null };

/** A product visual inside one of the demo's tinted frames (`co-line-art`, `co-os-art`, …). */
export function Art({ product, className, sizes = "120px", children, style }: { product: ProductCardData; className: string; sizes?: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <span className={cx(className, "co-frame", product.image?.url && "has-photo")} style={{ "--tint": productTint(product), ...style } as CSSProperties} aria-hidden="true">
      <ProductVisual product={product} sizes={sizes} decorative />
      {children}
    </span>
  );
}

/** Visual from an order snapshot (imageUrl + packshot art) — order items keep their own snapshot. */
export function SnapArt({
  name,
  brandName,
  imageUrl,
  art,
  own,
  className,
  sizes = "80px",
  children,
}: {
  name: string;
  brandName: string;
  imageUrl: string | null;
  art: ArtLike;
  own?: boolean;
  className: string;
  sizes?: string;
  children?: ReactNode;
}) {
  const product = {
    name,
    image: imageUrl ? { url: imageUrl, alt: null, width: null, height: null } : null,
    art,
    isOwnLabel: own,
    brand: { name: brandName, word: null, isOwn: Boolean(own) },
  };
  return (
    <span className={cx(className, "co-frame", imageUrl && "has-photo")} style={{ "--tint": art.c1 && /^#[0-9a-f]{3,8}$/i.test(art.c1) ? art.c1 : "#e7e4ee" } as CSSProperties} aria-hidden="true">
      {imageUrl ? <ProductVisual product={product} sizes={sizes} decorative /> : <Packshot art={art} name={name} brand={product.brand} isOwnLabel={own} labelled={false} />}
      {children}
    </span>
  );
}

const allowanceFor = (subtotal: number, tiers: GiftTierLite[]) => (subtotal <= 0 ? 0 : tiers.reduce((n, t) => (subtotal >= t.minAmount ? Math.max(n, t.giftCount) : n), 0));

export function topWorth(gifts: GiftOption[], n: number) {
  return gifts
    .filter((g) => g.stock > 0)
    .map((g) => g.worth)
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, n))
    .reduce((a, b) => a + b, 0);
}

/** The cart's FREE-GIFT METER — tiers as milestones on a track, the next unlock and gift minis. */
export function GiftMeter({ subtotal, tiers, gifts, pulse }: { subtotal: number; tiers: GiftTierLite[]; gifts: GiftOption[]; pulse?: boolean }) {
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  const allow = allowanceFor(subtotal, sorted);
  const next = sorted.find((t) => t.minAmount > subtotal && t.giftCount > allow) ?? null;
  const pts: (GiftTierLite & { origin?: boolean })[] = sorted[0].minAmount > 0 ? [{ minAmount: 0, giftCount: 0, origin: true }, ...sorted] : sorted;
  const n = pts.length;
  const pos = (i: number) => (n < 2 ? 100 : (i / (n - 1)) * 100);
  let fill = 100;
  for (let i = 0; i < n - 1; i++) {
    if (subtotal < pts[i + 1].minAmount) {
      fill = pos(i) + Math.max(0, (subtotal - pts[i].minAmount) / (pts[i + 1].minAmount - pts[i].minAmount)) * (pos(i + 1) - pos(i));
      break;
    }
  }
  const top = sorted[sorted.length - 1];
  return (
    <section className={cx("co-meter", pulse && "is-pulse")} aria-label="Free gift progress">
      <div className="co-meter-ic" aria-hidden="true">
        <Icon name="gift" />
      </div>
      <div className="co-meter-t">
        <h2>
          {allow ? (
            <>
              You&rsquo;ve unlocked <em>{plural(allow, "free gift")}</em>
            </>
          ) : (
            "Free gifts with every order"
          )}
        </h2>
        <p>
          {next ? (
            <>
              Add <b>{formatINR(next.minAmount - subtotal)}</b> more to unlock <b>{plural(next.giftCount, "gift")}</b> — you choose them at checkout.
            </>
          ) : (
            <>That&rsquo;s the maximum on one order — pick your {plural(allow, "TBB Original")} at checkout.</>
          )}
        </p>
      </div>
      <div
        className="co-track"
        role="progressbar"
        aria-label="Progress to the next free gift"
        aria-valuemin={0}
        aria-valuemax={top.minAmount}
        aria-valuenow={Math.min(subtotal, top.minAmount)}
        aria-valuetext={next ? `${formatINR(next.minAmount - subtotal)} away from ${next.giftCount} gifts` : "All gift tiers unlocked"}
      >
        <div className="co-track-in">
          <div className="co-track-bar">
            <i style={{ width: `${fill.toFixed(2)}%` }} />
          </div>
          {pts.map((t, i) =>
            t.origin ? null : (
              <span key={t.minAmount} className={cx("co-ms", subtotal >= t.minAmount && subtotal > 0 && "is-on")} style={{ left: `${pos(i).toFixed(2)}%` }}>
                <i>
                  <Icon name={subtotal >= t.minAmount && subtotal > 0 ? "check" : "gift"} />
                </i>
                <small>
                  <b>{plural(t.giftCount, "gift")}</b>
                  {t.minAmount ? `${formatINR(t.minAmount)}+` : "Any order"}
                </small>
              </span>
            ),
          )}
        </div>
      </div>
      <div className="co-meter-g">
        <div className="co-meter-minis" aria-hidden="true">
          {gifts.slice(0, 6).map((g) => (
            <Art key={g.id} product={g.product} className="co-mini" sizes="40px" />
          ))}
        </div>
        <small>
          {gifts.length} TBB Originals · worth up to {formatINR(topWorth(gifts, Math.max(allow, 1)))}
        </small>
      </div>
    </section>
  );
}

export function EmptyArt() {
  return (
    <svg className="co-empty-art" viewBox="0 0 160 140" aria-hidden="true">
      <defs>
        <linearGradient id="co-bag-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3d6e" />
          <stop offset="1" stopColor="#ff7a45" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="130" rx="56" ry="6" fill="#e6e1ef" />
      <path d="M58 50V40a22 22 0 0 1 44 0v10" fill="none" stroke="#33195a" strokeWidth="5" strokeLinecap="round" />
      <path d="M34 48h92l-6 72a9 9 0 0 1-9 8H49a9 9 0 0 1-9-8z" fill="url(#co-bag-g)" />
      <path d="M40 48h86" stroke="#fff" strokeOpacity=".35" strokeWidth="3" />
      <rect x="60" y="78" width="40" height="32" rx="4" fill="#fff" />
      <rect x="77" y="78" width="6" height="32" fill="#ffc94d" />
      <rect x="60" y="88" width="40" height="6" fill="#ffc94d" />
      <path d="M80 78c-9-12-21-6-15 0zM80 78c9-12 21-6 15 0z" fill="#ffc94d" stroke="#f0a92a" strokeWidth="1.5" />
      <path d="M128 22l2.4 6.6 6.6 2.4-6.6 2.4-2.4 6.6-2.4-6.6-6.6-2.4 6.6-2.4z" fill="#ffc94d" />
      <path d="M26 30l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#ff3d6e" opacity=".7" />
    </svg>
  );
}

/** Extra stroke icons used only by the checkout (demo EXTRA map). */
const EXTRA = {
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  bank: '<path d="M3 21h18M4 10h16M12 3 3 8h18z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  upi: '<path d="m7 4 5 8-5 8"/><path d="m13 4 5 8-5 8"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
} as const;
export type ExtraIcon = keyof typeof EXTRA;

export function XIcon({ name, className }: { name: ExtraIcon; className?: string }) {
  return (
    <svg
      className={cx("ic", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: EXTRA[name] }}
    />
  );
}

export function TrustList({ col }: { col?: boolean }) {
  return (
    <ul className={cx("co-trust", col && "is-col")} aria-label="Why shop with us">
      <li>
        <XIcon name="lock" />
        <span>
          <b>Secure payments</b>
          {col ? "256-bit encryption" : "UPI, cards, COD"}
        </span>
      </li>
      <li>
        <Icon name="shield" />
        <span>
          <b>100% authentic</b>
          {col ? "Sourced from brands" : "From brands & distributors"}
        </span>
      </li>
      <li>
        <Icon name="ret" />
        <span>
          <b>Easy returns</b>
          {col ? "7-day returns" : "7-day, no questions"}
        </span>
      </li>
    </ul>
  );
}

/** Status pill for orders / items. */
export function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === "DELIVERED" ? "ok" : status === "PENDING_PAYMENT" || status === "RETURN_REQUESTED" ? "warn" : status === "CANCELLED" ? "bad" : status === "RETURNED" || status === "REFUNDED" ? "mute" : "info";
  return <span className={cx("cm-pill", `is-${tone}`)}>{label}</span>;
}
