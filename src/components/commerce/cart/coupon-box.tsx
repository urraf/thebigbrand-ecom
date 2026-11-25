"use client";
import { useState } from "react";
import { formatINR } from "@/lib/money";
import type { CartView } from "@/types/shared";
import type { CouponOffer, Quote } from "@/server/checkout/types";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import { capi, errMessage } from "../api";

/**
 * Coupon apply / remove (POST|DELETE /api/v1/coupons/apply — validated on the server: active, dates, minimum
 * order, brand scope, usage + per-user limits) and the best offers for this cart.
 */
export function CouponBox({ quote, offers, onChange, compact }: { quote: Quote; offers: CouponOffer[]; onChange: (r: { cart: CartView; quote: Quote }) => void; compact?: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const apply = async (c: string) => {
    const value = c.trim();
    if (value.length < 2) {
      setError("Enter a coupon code");
      return;
    }
    setBusy(value.toUpperCase());
    setError(null);
    try {
      const r = await capi<{ cart: CartView; quote: Quote }>("/api/v1/coupons/apply", { method: "POST", json: { code: value } });
      onChange(r);
      setCode("");
      setOpen(false);
      toast(r.quote.coupon ? `${r.quote.coupon.code} applied — you save ${formatINR(r.quote.coupon.discount)}` : "Coupon applied", { icon: "tag" });
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const removeIt = async () => {
    setBusy("remove");
    try {
      onChange(await capi<{ cart: CartView; quote: Quote }>("/api/v1/coupons/apply", { method: "DELETE" }));
      toast("Coupon removed", { icon: "tag" });
    } catch (e) {
      toast(errMessage(e), { icon: "info" });
    } finally {
      setBusy(null);
    }
  };

  const applied = quote.coupon;
  const best = offers.filter((o) => !o.applied).slice(0, compact ? 3 : 4);

  return (
    <div className={cx("cm-coupon", compact && "is-compact")}>
      {applied ? (
        <div className="cm-cp-on">
          <Icon name="tag" />
          <span>
            <b>{applied.code}</b> applied
            <small>
              {applied.title}
              {applied.brandName ? ` · on ${applied.brandName}` : ""} — saving {formatINR(applied.discount)}
            </small>
          </span>
          <button type="button" className="co-tb" onClick={removeIt} disabled={busy !== null}>
            Remove
          </button>
        </div>
      ) : quote.couponIssue ? (
        <div className="cm-cp-issue" role="status">
          <Icon name="info" />
          <span>
            <b>{quote.couponIssue.code}</b> isn&rsquo;t applied: {quote.couponIssue.message}
          </span>
          <button type="button" className="co-tb" onClick={removeIt} disabled={busy !== null}>
            Remove
          </button>
        </div>
      ) : null}

      {!applied ? (
        <>
          <button type="button" className="cm-cp-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name="percent" />
            <span>
              {best.some((o) => o.applicable) ? (
                <>
                  <b>Apply a coupon</b> · best saving {formatINR(Math.max(...best.filter((o) => o.applicable).map((o) => o.discount)))}
                </>
              ) : (
                <b>Have a coupon code?</b>
              )}
            </span>
            <Icon name="chevDown" className={cx("cm-chev", open && "is-open")} />
          </button>
          {open ? (
            <div className="cm-cp-body">
              <form
                className="cm-cp-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void apply(code);
                }}
              >
                <label htmlFor="cm-cp-code" className="sr-only">
                  Coupon code
                </label>
                <input
                  id="cm-cp-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="Enter code"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={40}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="cm-cp-err"
                />
                <button type="submit" className="btn btn-dark btn-sm" disabled={busy !== null}>
                  {busy && busy !== "remove" && busy === code.trim().toUpperCase() ? "Applying…" : "Apply"}
                </button>
              </form>
              <p id="cm-cp-err" className="cm-cp-err" aria-live="polite">
                {error}
              </p>
              {best.length ? (
                <ul className="cm-offers" aria-label="Coupons for your cart">
                  {best.map((o) => (
                    <li key={o.code} className={cx(!o.applicable && "is-off")}>
                      <span className="cm-off-code">{o.code}</span>
                      <span className="cm-off-t">
                        <b>{o.title}</b>
                        <small>{o.applicable ? `${o.description ? `${o.description} · ` : ""}${o.message}` : o.message}</small>
                      </span>
                      {o.applicable ? (
                        <button type="button" className="co-tb" onClick={() => apply(o.code)} disabled={busy !== null}>
                          {busy === o.code ? "…" : "Apply"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
