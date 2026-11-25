import "server-only";
import type { CartView } from "@/types/shared";
import { getCartView, type CartOwner } from "@/server/cart/service";
import { evaluateCoupon } from "@/server/coupons/service";
import { getActiveGifts } from "@/server/gifts/service";
import { deliveryFee, getShippingSettings } from "./settings";
import type { CartQuote, ChosenGift, Quote } from "./types";

/**
 * QUOTE — the totals a shopper sees in the cart and at checkout, recomputed from the DB-priced CartView:
 * M.R.P., savings, coupon (re-validated every time), delivery (free over the Setting threshold), chosen free
 * gifts and the grand total. Order placement recomputes all of it again inside its transaction.
 */
export async function buildQuote(view: CartView, userId: string | null): Promise<Quote> {
  const [settings, gifts] = await Promise.all([getShippingSettings(), view.giftIds.length ? getActiveGifts() : Promise.resolve([])]);

  let coupon: Quote["coupon"] = null;
  let couponIssue: Quote["couponIssue"] = null;
  if (view.couponCode && view.lines.length) {
    const ev = await evaluateCoupon(view.couponCode, view, userId);
    if (ev.check.ok && ev.rule) {
      coupon = { code: ev.rule.code, title: ev.rule.title, description: ev.rule.description, discount: ev.check.discount, brandName: ev.rule.brandName };
    } else {
      couponIssue = { code: view.couponCode, message: ev.check.ok ? "" : ev.check.message };
    }
  }

  const byId = new Map(gifts.map((g) => [g.id, g]));
  const chosen: ChosenGift[] = view.giftIds
    .map((id) => byId.get(id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g))
    .map((g) => ({ id: g.id, productId: g.productId, miniName: g.miniName, miniSize: g.miniSize, worth: g.worth }));
  const giftWorth = chosen.reduce((a, g) => a + g.worth, 0);

  const couponDiscount = coupon?.discount ?? 0;
  const shippingFee = deliveryFee(view.subtotal, settings);
  const productDiscount = Math.max(0, view.mrpTotal - view.subtotal);
  return {
    count: view.count,
    mrpTotal: view.mrpTotal,
    subtotal: view.subtotal,
    productDiscount,
    coupon,
    couponIssue,
    couponDiscount,
    shippingFee,
    standardShippingFee: settings.shippingFee,
    freeShippingMin: settings.freeShippingMin,
    codEnabled: settings.codEnabled,
    codFee: settings.codFee,
    total: Math.max(0, view.subtotal - couponDiscount) + shippingFee,
    giftAllowance: view.giftAllowance,
    nextTier: view.nextTier,
    gifts: chosen,
    giftWorth,
    savings: productDiscount + couponDiscount + giftWorth,
  };
}

/** Cart + quote for a cart owner (guest or signed-in). */
export async function getCartQuote(owner: CartOwner): Promise<CartQuote> {
  const cart = await getCartView(owner);
  return { cart, quote: await buildQuote(cart, owner.userId) };
}
