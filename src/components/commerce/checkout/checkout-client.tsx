"use client";
/**
 * CHECKOUT — focused 3-step flow: (1) delivery address, (2) free gifts, (3) payment. Totals always come from
 * the server (CheckoutSummary.quote); placing the order POSTs /api/v1/checkout/place with an idempotency key,
 * then COD → order page, TEST → the built-in gateway page, RAZORPAY → Checkout.js + signature verification.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import type { CartView } from "@/types/shared";
import type { AddressView, CheckoutSummary, PlaceMethod, PlaceResult, Quote } from "@/server/checkout/types";
import { useCart } from "@/components/cart/cart-context";
import { LogoMark } from "@/components/store/logo";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";
import { site } from "@/lib/site";
import { capi, CommerceError, errMessage, plural } from "../api";
import { AddressCard, AddressForm } from "../address-form";
import { TrustList, XIcon, type ExtraIcon } from "../parts";
import { CouponBox } from "../cart/coupon-box";
import { GiftChips, GiftStep } from "./gift-step";
import { OrderSummary, summaryTotals } from "./order-summary";
import { openRazorpay, PaymentDismissed } from "./razorpay";

type Step = 1 | 2 | 3;

const PAY: Record<PlaceMethod, { label: string; icon: ExtraIcon | "card"; sub: string; tag?: string }> = {
  UPI: { label: "UPI", icon: "upi", sub: "Google Pay, PhonePe, Paytm, BHIM & any UPI app", tag: "Most used" },
  CARD: { label: "Credit / Debit card", icon: "card", sub: "Visa, Mastercard, RuPay & Amex" },
  NETBANKING: { label: "Net banking", icon: "bank", sub: "All major Indian banks" },
  COD: { label: "Cash on delivery", icon: "cash", sub: "Pay by cash or UPI at your doorstep" },
};

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`);
const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function CheckoutClient({ initial, paymentFailed }: { initial: CheckoutSummary; paymentFailed: string | null }) {
  const router = useRouter();
  const { refresh: refreshCart, setGifts } = useCart();
  const [cart, setCart] = useState<CartView>(initial.cart);
  const [quote, setQuote] = useState<Quote>(initial.quote);
  const [addresses, setAddresses] = useState<AddressView[]>(initial.addresses);
  const [addressId, setAddressId] = useState<string | null>(initial.addresses.find((a) => a.isDefault)?.id ?? initial.addresses[0]?.id ?? null);
  const [editing, setEditing] = useState<"new" | string | null>(initial.addresses.length ? null : "new");
  const [giftIds, setGiftIds] = useState<string[]>(initial.cart.giftIds);
  const [giftErr, setGiftErr] = useState(false);
  const [method, setMethod] = useState<PlaceMethod>("UPI");
  const [step, setStep] = useState<Step>(() => (paymentFailed && initial.addresses.length ? 3 : initial.addresses.length ? 2 : 1));
  const [placing, setPlacing] = useState(false);
  const [alert, setAlert] = useState<{ tone: "err" | "warn" | "info"; text: string; retry?: string } | null>(
    paymentFailed ? { tone: "err", text: `Payment for order ${paymentFailed} didn't go through — nothing was charged. Your cart and gift picks are saved; choose a payment method to try again.` } : null,
  );
  const keyRef = useRef<string>(newKey());
  const pendingGifts = useRef<Promise<boolean> | null>(null);
  const giftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestGifts = useRef<string[]>(initial.cart.giftIds);

  const gifts = initial.gifts;
  const address = addresses.find((a) => a.id === addressId) ?? null;
  const giftWorth = useMemo(() => giftIds.reduce((a, id) => a + (gifts.find((g) => g.id === id)?.worth ?? 0), 0), [giftIds, gifts]);
  const totals = summaryTotals(quote, giftWorth, method === "COD");
  const codOk = initial.payment.codEnabled;
  const testMode = initial.payment.mode === "TEST";
  const allowance = quote.giftAllowance;
  const anyGiftInStock = gifts.some((g) => g.stock > 0);

  // a new attempt (fresh idempotency key) whenever what would be ordered changes
  useEffect(() => {
    keyRef.current = newKey();
  }, [addressId, method, giftIds, quote.total]);

  // hidden by the router's <Activity> (e.g. navigating to the gateway): come back un-stuck from "Placing…"
  useEffect(() => () => setPlacing(false), []);

  const scrollToStep = useCallback((n: Step) => {
    requestAnimationFrame(() => {
      const card = document.getElementById(`co-s${n}`);
      if (card) window.scrollTo({ top: Math.max(0, card.getBoundingClientRect().top + window.scrollY - 12), behavior: reduced() ? "auto" : "smooth" });
      document.getElementById(`co-s${n}-h`)?.focus({ preventScroll: true });
    });
  }, []);

  const goStep = useCallback(
    (n: Step) => {
      setStep(n);
      scrollToStep(n);
    },
    [scrollToStep],
  );

  const reloadSummary = useCallback(async () => {
    try {
      const s = await capi<CheckoutSummary>("/api/v1/checkout/summary");
      setCart(s.cart);
      setQuote(s.quote);
      setAddresses(s.addresses);
      setGiftIds(s.cart.giftIds);
      latestGifts.current = s.cart.giftIds;
      void refreshCart();
      return s;
    } catch {
      return null;
    }
  }, [refreshCart]);

  // ── gifts: local selection, persisted (debounced, serialised) through the cart API ──
  const persistGifts = useCallback((ids: string[]) => {
    const run = async () => {
      await pendingGifts.current?.catch(() => {});
      return setGifts(ids);
    };
    pendingGifts.current = run();
    return pendingGifts.current;
  }, [setGifts]);

  const onGiftsChange = (ids: string[]) => {
    setGiftIds(ids);
    latestGifts.current = ids;
    if (ids.length) setGiftErr(false);
    if (giftTimer.current) clearTimeout(giftTimer.current);
    giftTimer.current = setTimeout(() => {
      giftTimer.current = null;
      void persistGifts(ids);
    }, 350);
  };

  const flushGifts = async (): Promise<boolean> => {
    if (giftTimer.current) {
      clearTimeout(giftTimer.current);
      giftTimer.current = null;
      return persistGifts(latestGifts.current);
    }
    return (await pendingGifts.current) ?? true;
  };

  const giftsNext = async () => {
    if (!giftIds.length && allowance > 0 && anyGiftInStock) {
      setGiftErr(true);
      if (step !== 2) goStep(2);
      else document.getElementById("co-tray")?.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
      return;
    }
    if (!(await flushGifts())) return;
    goStep(3);
  };

  // ── addresses ──
  const onAddressSaved = (a: AddressView) => {
    setAddresses((list) => {
      const rest = list.filter((x) => x.id !== a.id).map((x) => (a.isDefault ? { ...x, isDefault: false } : x));
      return a.isDefault ? [a, ...rest] : [...rest, a].sort((x, y) => Number(y.isDefault) - Number(x.isDefault));
    });
    setAddressId(a.id);
    setEditing(null);
    toast(editing === "new" ? "Address saved" : "Address updated", { icon: "check" });
    goStep(2);
  };

  const deleteAddress = async (a: AddressView) => {
    if (!window.confirm(`Delete the address for ${a.name}, ${a.city}?`)) return;
    try {
      const r = await capi<{ ok: true; defaultId: string | null }>(`/api/v1/account/addresses/${encodeURIComponent(a.id)}`, { method: "DELETE" });
      setAddresses((list) => list.filter((x) => x.id !== a.id).map((x) => (x.id === r.defaultId ? { ...x, isDefault: true } : x)));
      if (addressId === a.id) setAddressId(r.defaultId ?? addresses.find((x) => x.id !== a.id)?.id ?? null);
      if (addresses.length <= 1) setEditing("new");
      toast("Address deleted", { icon: "trash" });
    } catch (e) {
      toast(errMessage(e), { icon: "info" });
    }
  };

  const makeDefault = async (a: AddressView) => {
    try {
      const saved = await capi<AddressView>(`/api/v1/account/addresses/${encodeURIComponent(a.id)}`, { method: "PATCH", json: { isDefault: true } });
      setAddresses((list) => [saved, ...list.filter((x) => x.id !== a.id).map((x) => ({ ...x, isDefault: false }))]);
    } catch (e) {
      toast(errMessage(e), { icon: "info" });
    }
  };

  // ── place order ──
  const handleError = async (e: unknown) => {
    if (e instanceof CommerceError) {
      const stepHint = typeof e.details?.step === "string" ? e.details.step : null;
      if (e.status === 409 && stepHint === "cart") {
        setAlert({ tone: "warn", text: e.message });
        const s = await reloadSummary();
        if (s && !s.cart.lines.length) router.replace("/cart");
        return;
      }
      if (e.code === "CONFLICT" && e.details?.code === "ATTEMPT_ENDED") keyRef.current = newKey();
      if (stepHint === "gifts") {
        await reloadSummary();
        setGiftErr(true);
        goStep(2);
      } else if (stepHint === "address") goStep(1);
      else if (stepHint === "coupon") await reloadSummary();
      setAlert({ tone: "err", text: e.message });
      return;
    }
    setAlert({ tone: "err", text: errMessage(e) });
  };

  const finishPaid = async (number: string) => {
    await refreshCart();
    router.push(`/order/${encodeURIComponent(number)}`);
  };

  const payWithRazorpay = async (r: PlaceResult) => {
    const rzp = r.payment.razorpay!;
    try {
      const signed = await openRazorpay(rzp);
      const v = await capi<{ orderNumber: string; redirect: string }>("/api/v1/payments/razorpay/verify", { method: "POST", json: signed });
      await finishPaid(v.orderNumber);
    } catch (e) {
      if (e instanceof PaymentDismissed) {
        setAlert({ tone: "warn", text: `Payment not completed for order ${r.order.number}. Your order is reserved for 30 minutes.`, retry: r.order.number });
      } else {
        setAlert({ tone: "err", text: errMessage(e) });
      }
      setPlacing(false);
    }
  };

  const place = async () => {
    if (placing) return;
    setAlert(null);
    if (!address) {
      setAlert({ tone: "err", text: "Choose a delivery address for this order" });
      return goStep(1);
    }
    if (!giftIds.length && allowance > 0 && anyGiftInStock) {
      setGiftErr(true);
      toast("Pick your free gift first", { icon: "gift" });
      return goStep(2);
    }
    setPlacing(true);
    try {
      if (!(await flushGifts())) {
        setPlacing(false);
        return goStep(2);
      }
      const r = await capi<PlaceResult>("/api/v1/checkout/place", { method: "POST", json: { addressId: address.id, method, idempotencyKey: keyRef.current } });
      if (r.payment.razorpay) return payWithRazorpay(r);
      if (r.redirect?.startsWith("/order/")) return finishPaid(r.order.number);
      if (r.redirect) return router.push(r.redirect);
      setPlacing(false);
    } catch (e) {
      setPlacing(false);
      await handleError(e);
    }
  };

  const retryPayment = async (number: string) => {
    setPlacing(true);
    setAlert(null);
    try {
      const r = await capi<PlaceResult>(`/api/v1/orders/${encodeURIComponent(number)}/pay`, { method: "POST" });
      if (r.payment.razorpay) return payWithRazorpay(r);
      if (r.redirect) return router.push(r.redirect);
    } catch (e) {
      setPlacing(false);
      await handleError(e);
    }
  };

  const onCoupon = (r: { cart: CartView; quote: Quote }) => {
    setCart(r.cart);
    setQuote(r.quote);
    void refreshCart();
  };

  const placeLabel = method === "COD" ? `Place order · ${formatINR(totals.total)}` : `Pay ${formatINR(totals.total)}`;
  const placeBtn = (cls = "btn btn-cart btn-lg") => (
    <button type="button" className={cls} onClick={place} disabled={placing} aria-busy={placing || undefined}>
      {placing ? (
        <>
          <span className="co-spin" aria-hidden="true" />
          {method === "COD" ? "Placing order…" : "Opening payment…"}
        </>
      ) : (
        placeLabel
      )}
    </button>
  );

  const stepState = (n: Step) => (n < step ? "done" : n === step ? "open" : "todo");
  const head = (n: Step, title: string, summary: React.ReactNode, todo: React.ReactNode) => {
    const st = stepState(n);
    return (
      <header className="co-sc-h">
        <span className="co-sc-n" aria-hidden="true">
          {st === "done" ? <Icon name="check" /> : n}
        </span>
        <div className="co-sc-tt">
          <h2 id={`co-s${n}-h`} tabIndex={-1}>
            {title}
          </h2>
          {st === "done" ? <div className="co-sc-sum">{summary}</div> : st === "todo" ? <div className="co-sc-sum">{todo}</div> : null}
        </div>
        {st === "done" ? (
          <button type="button" className="co-change" onClick={() => goStep(n)} aria-label={`Change ${title.toLowerCase()}`}>
            Change
          </button>
        ) : null}
      </header>
    );
  };

  const firstName = (initial.user.name ?? address?.name ?? "").trim().split(/\s+/)[0] || "";

  return (
    <>
      <header className="co-mh">
        <div className="co-mh-in">
          <Link className="co-mh-logo" href="/" aria-label="The Big Brands home">
            <LogoMark />
          </Link>
          <ol className="co-prog" aria-label="Checkout progress">
            {["Address", "Free gifts", "Payment"].map((t, i) => {
              const n = (i + 1) as Step;
              const st = n < step ? "done" : n === step ? "now" : "todo";
              return (
                <li key={t} className={`is-${st}`} aria-current={st === "now" ? "step" : undefined}>
                  <i>{st === "done" ? <Icon name="check" /> : n}</i>
                  <span>{t}</span>
                </li>
              );
            })}
          </ol>
          <span className="co-mh-sec">
            <XIcon name="lock" />
            <span>Secure checkout</span>
          </span>
        </div>
      </header>
      <div className="co-ck">
        <div className="co-ck-main">
          <div className="co-ck-top">
            <h1>Checkout</h1>
            <span>
              {plural(cart.count, "item")} · {formatINR(totals.total)}
            </span>
          </div>
          <details className="co-os-m">
            <summary>
              <span>
                <Icon name="cart" />
                Order summary <small>{plural(cart.count, "item")}</small>
              </span>
              <b>{formatINR(totals.total)}</b>
              <Icon name="chevDown" />
            </summary>
            <div className="co-os co-os-in">
              <OrderSummary cart={cart} quote={quote} gifts={gifts} selected={giftIds} cod={method === "COD"} />
            </div>
          </details>

          {alert ? (
            <p className={cx("cm-alert", `is-${alert.tone}`)} role="alert">
              <Icon name="info" />
              <span>{alert.text}</span>
              {alert.retry ? (
                <button type="button" className="co-tb" onClick={() => retryPayment(alert.retry!)} disabled={placing}>
                  Retry payment
                </button>
              ) : null}
            </p>
          ) : null}

          {/* 1 · address */}
          <section className={`blk co-sc is-${stepState(1)}`} id="co-s1" aria-labelledby="co-s1-h">
            {head(
              1,
              "Delivery address",
              address ? (
                <>
                  <b>{address.name}</b>, {address.line1}, {address.city}, {address.state} {address.pincode} · +91 {address.phone}
                </>
              ) : (
                "Add a delivery address"
              ),
              "",
            )}
            {stepState(1) === "open" ? (
              <div className="co-sc-b">
                {editing ? (
                  <>
                    {addresses.length ? <p className="cm-sub-h">{editing === "new" ? "Add a new address" : "Edit address"}</p> : null}
                    <AddressForm
                      key={editing}
                      address={editing === "new" ? null : addresses.find((a) => a.id === editing)}
                      defaultName={initial.user.name}
                      defaultPhone={initial.user.phone}
                      forceDefault={!addresses.length}
                      submitLabel={editing === "new" ? "Deliver to this address" : "Save & deliver here"}
                      onSaved={onAddressSaved}
                      onCancel={addresses.length ? () => setEditing(null) : undefined}
                    />
                  </>
                ) : (
                  <>
                    <div className="cm-ads" role="radiogroup" aria-label="Saved addresses">
                      {addresses.map((a) => (
                        <AddressCard key={a.id} a={a} selected={a.id === addressId} onSelect={() => setAddressId(a.id)} onEdit={() => setEditing(a.id)} onDelete={() => deleteAddress(a)} onDefault={() => makeDefault(a)} />
                      ))}
                      <button type="button" className="cm-ad-new" onClick={() => setEditing("new")}>
                        <Icon name="plus" />
                        Add a new address
                      </button>
                    </div>
                    <p className="co-eta">
                      <Icon name="truck" />
                      <span>
                        Usually delivered in <b>2–4 days</b>
                        {address ? (
                          <>
                            {" "}
                            to pincode <b>{address.pincode}</b>
                          </>
                        ) : null}
                        {codOk ? " · Cash on delivery available" : ""}
                      </span>
                    </p>
                    <div className="co-sc-foot">
                      <span />
                      <button type="button" className="btn btn-cart btn-lg" disabled={!address} onClick={() => goStep(2)}>
                        Deliver to this address <Icon name="arrow" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </section>

          {/* 2 · gifts */}
          <section className={`blk co-sc is-${stepState(2)}`} id="co-s2" aria-labelledby="co-s2-h">
            {head(2, `Choose your free gift${allowance > 1 ? "s" : ""}`, <GiftChips gifts={gifts} selected={giftIds} />, `Pick ${plural(allowance, "complimentary TBB Original")} — free with this order`)}
            {stepState(2) === "open" ? (
              <div className="co-sc-b">
                <GiftStep gifts={gifts} selected={giftIds} allowance={allowance} nextTier={quote.nextTier} subtotal={quote.subtotal} error={giftErr} onChange={onGiftsChange} onNext={giftsNext} />
              </div>
            ) : null}
          </section>

          {/* 3 · payment */}
          <section className={`blk co-sc is-${stepState(3)}`} id="co-s3" aria-labelledby="co-s3-h">
            {head(3, "Payment", PAY[method].label, codOk ? "UPI, cards, net banking or cash on delivery" : "UPI, cards or net banking")}
            {stepState(3) === "open" ? (
              <div className="co-sc-b">
                <fieldset className="co-pays">
                  <legend className="sr-only">Payment method</legend>
                  {(Object.keys(PAY) as PlaceMethod[]).map((k) => {
                    const o = PAY[k];
                    const on = method === k;
                    const disabled = k === "COD" && !codOk;
                    return (
                      <div key={k} className={cx("co-pay", on && "is-on", disabled && "is-disabled")}>
                        <label className="co-pay-h">
                          <input type="radio" name="co-pay" value={k} checked={on} disabled={disabled} onChange={() => setMethod(k)} />
                          <span className="co-radio" aria-hidden="true" />
                          <span className="co-pay-ic">{o.icon === "card" ? <Icon name="card" /> : <XIcon name={o.icon} />}</span>
                          <span className="co-pay-t">
                            <b>{o.label}</b>
                            <small>{disabled ? "Not available right now" : o.sub}</small>
                          </span>
                          {k === "COD" && initial.payment.codFee > 0 ? <span className="co-pay-tag is-fee">+{formatINR(initial.payment.codFee)}</span> : o.tag ? <span className="co-pay-tag">{o.tag}</span> : null}
                        </label>
                        {on ? (
                          <div className="co-pay-d">
                            {k === "COD" ? (
                              <p className="co-cod">
                                <Icon name="home" />
                                <span>
                                  Pay <b>{formatINR(totals.total)}</b> in cash or by scanning a UPI QR when your order arrives
                                  {address ? (
                                    <>
                                      {" "}
                                      at pincode <b>{address.pincode}</b>
                                    </>
                                  ) : null}
                                  .
                                </span>
                              </p>
                            ) : testMode ? (
                              <p className="co-pay-note">
                                <Icon name="shield" />
                                You&rsquo;ll confirm <b>{formatINR(totals.total)}</b> on our secure payment page next.
                              </p>
                            ) : (
                              <p className="co-pay-note">
                                <Icon name="shield" />
                                You&rsquo;ll pay <b>{formatINR(totals.total)}</b> in the secure Razorpay window — {k === "UPI" ? "approve the request in your UPI app" : k === "CARD" ? "cards are tokenised as per RBI guidelines; we never see your card number" : "choose your bank and sign in"}.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </fieldset>
                {testMode && method !== "COD" ? (
                  <p className="co-demo">
                    <Icon name="info" />
                    <span>
                      <b>Test payment mode</b> — no live payment gateway is connected yet, so online payments open our built-in test gateway where you can approve or decline the payment. No money is charged.
                    </span>
                  </p>
                ) : null}
                <div className="co-sc-foot">
                  <p className="co-foot-note">
                    By placing your order you agree to our{" "}
                    <Link href="/terms" target="_blank">
                      Terms of use
                    </Link>
                    ,{" "}
                    <Link href="/privacy" target="_blank">
                      Privacy policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/returns" target="_blank">
                      Returns policy
                    </Link>
                    .{" "}
                    {giftIds.length ? `Your ${plural(giftIds.length, "free gift")} will be packed in the same box.` : ""}
                  </p>
                  {placeBtn()}
                </div>
              </div>
            ) : null}
          </section>
          <p className="co-ck-help">
            Need help? Call <b>{site.supportPhone}</b> (9 am – 9 pm) ·{" "}
            <Link href="/help" className="link" target="_blank">
              Help centre
            </Link>{" "}
            ·{" "}
            <Link href="/cart" className="link">
              Back to cart
            </Link>
          </p>
        </div>
        <aside className="co-ck-side" aria-label="Order summary">
          <div className="blk co-os">
            <OrderSummary
              cart={cart}
              quote={quote}
              gifts={gifts}
              selected={giftIds}
              cod={method === "COD"}
              coupon={<CouponBox quote={quote} offers={[]} onChange={onCoupon} compact />}
              cta={step === 3 ? placeBtn("btn btn-cart btn-lg co-os-cta") : null}
            />
          </div>
          <TrustList col />
          {firstName ? <p className="cm-hi">Signed in as {initial.user.name ?? initial.user.email ?? initial.user.phone}</p> : null}
        </aside>
      </div>
      <div className="co-mbar">
        <div className="co-mbar-t">
          <b>{formatINR(totals.total)}</b>
          <small>{totals.saved > 0 ? `You save ${formatINR(totals.saved)}` : "Incl. all taxes"}</small>
        </div>
        {step === 1 ? (
          <button type="button" className="btn btn-cart" disabled={!address || editing !== null} onClick={() => goStep(2)}>
            Continue <Icon name="arrow" />
          </button>
        ) : step === 2 ? (
          <button type="button" className="btn btn-cart" onClick={giftsNext}>
            Continue <Icon name="arrow" />
          </button>
        ) : (
          placeBtn("btn btn-cart")
        )}
      </div>
    </>
  );
}
