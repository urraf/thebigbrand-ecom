"use client";
/**
 * Checkout step 2 — CHOOSE YOUR FREE GIFT(S). The gift box tray (slots up to the allowance + locked slots of
 * the next tier), the grid of TBB Originals minis (FREE badge, worth ₹X struck to ₹0, stock), swap when the
 * allowance is 1, "Surprise me" shuffle and the "add ₹X more to unlock N gifts" upsell.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import type { GiftOption, GiftTierLite } from "@/types/shared";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import { plural } from "../api";
import { Art, XIcon } from "../parts";

const BOW = (
  <svg className="co-bow" viewBox="0 0 48 30" aria-hidden="true">
    <path d="M24 14C18 3 5 1 4 8s10 9 20 6z" fill="#fff" />
    <path d="M24 14c6-11 19-13 20-6s-10 9-20 6z" fill="#ffe3ea" />
    <path d="M24 14l-8 13 4.5-1 3.5 3.5zM24 14l8 13-4.5-1-3.5 3.5z" fill="#ffd0dc" />
    <circle cx="24" cy="14" r="4.2" fill="#fff" />
  </svg>
);

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function GiftStep({
  gifts,
  selected,
  allowance,
  nextTier,
  subtotal,
  error,
  onChange,
  onNext,
}: {
  gifts: GiftOption[];
  selected: string[];
  allowance: number;
  nextTier: GiftTierLite | null;
  subtotal: number;
  error: boolean;
  onChange: (ids: string[]) => void;
  onNext: () => void;
}) {
  const [justPicked, setJustPicked] = useState<string | null>(null);
  const [spin, setSpin] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const shuffle = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (shuffle.current && clearInterval(shuffle.current)), []);

  const byId = new Map(gifts.map((g) => [g.id, g]));
  const picked = selected.map((id) => byId.get(id)).filter((g): g is GiftOption => Boolean(g));
  const worth = picked.reduce((a, g) => a + g.worth, 0);
  const inStock = gifts.filter((g) => g.stock > 0);

  const toggle = (g: GiftOption) => {
    if (shuffle.current || g.stock <= 0 || !allowance) return;
    if (selected.includes(g.id)) {
      onChange(selected.filter((x) => x !== g.id));
      setJustPicked(null);
    } else if (allowance === 1) {
      if (selected.length) toast(`Swapped to ${g.miniName}`, { icon: "gift" });
      onChange([g.id]);
      setJustPicked(g.id);
    } else if (selected.length < allowance) {
      onChange([...selected, g.id]);
      setJustPicked(g.id);
    } else {
      if (!reduced()) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
      toast(`Your box is full — tap ✕ on a gift above to swap in ${g.miniName}`, { icon: "gift" });
    }
  };

  const surprise = () => {
    if (shuffle.current || !allowance || !inStock.length) return;
    const pickN = () => {
      const fresh = inStock.filter((g) => !selected.includes(g.id));
      const src = fresh.length >= allowance ? fresh : inStock;
      return src
        .map((g) => [Math.random(), g.id] as const)
        .sort((a, b) => a[0] - b[0])
        .slice(0, allowance)
        .map((x) => x[1]);
    };
    const finish = () => {
      if (shuffle.current) clearInterval(shuffle.current);
      shuffle.current = null;
      setSpin(null);
      const pick = pickN();
      onChange(pick);
      setJustPicked(pick[pick.length - 1] ?? null);
      toast(`Surprise! ${pick.map((id) => byId.get(id)?.miniName).join(" + ")} — on the house`, { icon: "sparkle" });
    };
    if (reduced()) return finish();
    let i = 0;
    shuffle.current = setInterval(() => {
      setSpin(inStock[Math.floor(Math.random() * inStock.length)]?.id ?? null);
      if (++i > 9) finish();
    }, 85);
  };

  const slots = [];
  for (let i = 0; i < allowance; i++) {
    const g = picked[i];
    slots.push(
      g ? (
        <button key={`s${i}`} type="button" className={cx("co-slot is-full", g.id === justPicked && "is-new")} onClick={() => toggle(g)} aria-label={`Remove ${g.miniName} from your gift box`}>
          <Art product={g.product} className="co-slot-art" sizes="64px" />
          <span className="co-slot-x">
            <Icon name="close" />
          </span>
        </button>
      ) : (
        <span key={`s${i}`} className="co-slot">
          <i>
            <Icon name="gift" />
          </i>
          <small>Gift {i + 1}</small>
        </span>
      ),
    );
  }
  if (nextTier) {
    for (let i = allowance; i < nextTier.giftCount; i++) {
      slots.push(
        <Link key={`l${i}`} className="co-slot is-lock" href="/s?sort=best" aria-label={`Locked gift — add ${formatINR(nextTier.minAmount - subtotal)} more to unlock`}>
          <i>
            <XIcon name="lock" />
          </i>
          <small>+{formatINR(nextTier.minAmount - subtotal)}</small>
        </Link>,
      );
    }
  }

  const full = allowance > 1 && selected.length >= allowance;
  const hint = allowance === 1 ? "Tap a different gift to swap your pick." : `Pick up to ${allowance}. Tap a picked gift again to remove it.`;

  if (!gifts.length || !inStock.length) {
    return (
      <>
        <p className="cm-alert is-info">
          <Icon name="info" />
          <span>Our free gifts are being restocked right now — your order ships without one this time. Thank you for understanding!</span>
        </p>
        <div className="co-sc-foot">
          <span />
          <button type="button" className="btn btn-cart btn-lg" onClick={onNext}>
            Continue to payment <Icon name="arrow" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={cx("co-tray", error && "is-err", (shake || error) && "is-shake")} id="co-tray">
        <div className="co-tray-t">
          <b>Your gift box</b>
          <span>
            <em>{selected.length}</em> of {allowance} picked{worth ? ` · worth ${formatINR(worth)}` : ""}
          </span>
        </div>
        <div className="co-slots">{slots}</div>
        <button type="button" className="btn btn-ghost btn-sm co-surprise" onClick={surprise}>
          <Icon name="sparkle" /> Surprise me
        </button>
      </div>
      <p className="co-gerr" role="alert">
        {error ? (
          <>
            <Icon name="info" />
            Pick at least one free gift to continue — it&rsquo;s on us
          </>
        ) : null}
      </p>
      <p className="co-ghint">
        Complimentary minis from <b>TBB Originals</b>, our own label — packed with your order at no cost. {hint}
      </p>
      <div className={cx("co-ggrid", full && "is-full")} role="group" aria-label="Choose your free gifts">
        {gifts.map((g) => {
          const on = selected.includes(g.id);
          const out = g.stock <= 0;
          const low = !out && g.stock < 60;
          return (
            <button
              key={g.id}
              type="button"
              className={cx("co-gift", on && "is-on", g.id === justPicked && "is-new", spin === g.id && "is-spin")}
              onClick={() => toggle(g)}
              aria-pressed={on}
              disabled={out}
              aria-label={`${g.miniName}, ${g.miniSize}, worth ${formatINR(g.worth)}, free${out ? ", out of stock" : ""}`}
            >
              <Art product={g.product} className="co-gift-img" sizes="(max-width: 600px) 45vw, 200px">
                <span className="co-gift-free">FREE</span>
                <span className="co-gift-tick">
                  <Icon name="check" />
                </span>
                <span className="co-gift-in" aria-hidden="true">
                  {BOW}In your gift box
                </span>
              </Art>
              <span className="co-gift-body">
                <span className="co-gift-n">{g.miniName}</span>
                <span className="co-gift-m">{g.miniSize} · TBB Originals</span>
                <span className="co-gift-w">
                  worth <s>{formatINR(g.worth)}</s> <b>₹0</b>
                </span>
                {out ? <span className="co-gift-low">Out of stock</span> : low ? <span className="co-gift-low">Only {g.stock} left</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {nextTier ? (
        <Link className="co-gup" href="/s?sort=best">
          <Icon name="gift" />
          <span>
            <b>
              Add {formatINR(nextTier.minAmount - subtotal)} more to unlock {plural(nextTier.giftCount, "free gift")}
            </b>
            <small>Browse add-ons — your cart and gift picks stay saved</small>
          </span>
          <span className="co-gup-go">
            Shop <Icon name="arrow" />
          </span>
        </Link>
      ) : (
        <p className="co-gmax">
          <Icon name="sparkle" />
          <span>
            You&rsquo;ve unlocked the maximum <b>{plural(allowance, "free gift")}</b> on this order.
          </span>
        </p>
      )}
      <div className="co-sc-foot">
        <p className="co-foot-note">
          <Icon name="gift" />
          Gifts are packed in the same box and can&rsquo;t be exchanged for cash.
        </p>
        <button type="button" className="btn btn-cart btn-lg" onClick={onNext}>
          Continue to payment <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}

export function GiftChips({ gifts, selected }: { gifts: GiftOption[]; selected: string[] }) {
  const byId = new Map(gifts.map((g) => [g.id, g]));
  const picked = selected.map((id) => byId.get(id)).filter((g): g is GiftOption => Boolean(g));
  if (!picked.length) return <>No gift picked yet</>;
  return (
    <span className="co-gchips">
      {picked.map((g) => (
        <span key={g.id} className="co-gchip">
          <Art product={g.product} className="co-gchip-art" sizes="28px" />
          {g.miniName} · {g.miniSize}
        </span>
      ))}
      <span className="free">FREE</span>
    </span>
  );
}
