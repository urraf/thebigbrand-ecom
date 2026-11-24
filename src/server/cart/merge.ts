import "server-only";
import { db } from "@/lib/db";
import { MAX_QTY } from "./service";

/**
 * Merge a guest cart (cookie `tbb_cart`) into the signed-in user's cart after login.
 * Called by the auth routes (src/server/auth/session-response.ts) and lazily by the cart API when a signed-in
 * request still carries a guest cookie. Quantities are summed (capped at stock and 10 per item), gifts and
 * coupon carry over when the user's cart has none, then the guest cart is deleted. Never throws.
 */
export async function mergeGuestCart(userId: string, guestToken: string | undefined | null): Promise<void> {
  if (!userId || !guestToken) return;
  try {
    const guest = await db.cart.findUnique({
      where: { guestToken },
      select: { id: true, userId: true, giftIds: true, couponCode: true, items: { select: { productId: true, qty: true, savedForLater: true } } },
    });
    if (!guest || guest.userId) return;

    await db.$transaction(async (tx) => {
      const userCart = await tx.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true, giftIds: true, couponCode: true, items: { select: { productId: true, qty: true, savedForLater: true } } },
      });
      const products = await tx.product.findMany({
        where: { id: { in: guest.items.map((i) => i.productId) } },
        select: { id: true, stock: true },
      });
      const stockOf = new Map(products.map((p) => [p.id, p.stock]));
      const mine = new Map(userCart.items.map((i) => [i.productId, i]));

      for (const g of guest.items) {
        if (!stockOf.has(g.productId)) continue; // product deleted
        const cap = Math.max(1, Math.min(MAX_QTY, stockOf.get(g.productId) ?? MAX_QTY));
        const ex = mine.get(g.productId);
        if (!ex) {
          await tx.cartItem.create({ data: { cartId: userCart.id, productId: g.productId, qty: Math.min(cap, g.qty), savedForLater: g.savedForLater } });
          continue;
        }
        let qty = ex.qty;
        let savedForLater = ex.savedForLater;
        if (!ex.savedForLater && !g.savedForLater) qty = Math.min(cap, ex.qty + g.qty);
        else if (ex.savedForLater && !g.savedForLater) {
          qty = Math.min(cap, g.qty);
          savedForLater = false;
        }
        if (qty !== ex.qty || savedForLater !== ex.savedForLater) {
          await tx.cartItem.update({ where: { cartId_productId: { cartId: userCart.id, productId: g.productId } }, data: { qty, savedForLater } });
        }
      }

      const carry: { giftIds?: string[]; couponCode?: string } = {};
      if (!userCart.giftIds.length && guest.giftIds.length) carry.giftIds = guest.giftIds;
      if (!userCart.couponCode && guest.couponCode) carry.couponCode = guest.couponCode;
      if (Object.keys(carry).length) await tx.cart.update({ where: { id: userCart.id }, data: carry });

      await tx.cart.delete({ where: { id: guest.id } });
    });
  } catch (e) {
    console.error("[cart] guest cart merge failed", e);
  }
}
