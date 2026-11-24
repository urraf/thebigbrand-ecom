import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, type Prisma } from "@/lib/db";
import { err } from "@/lib/api";
import { TAGS } from "@/lib/cache";
import { randomToken } from "@/lib/ids";
import { site } from "@/lib/site";
import { productCardSelect, toProductCard } from "@/server/catalog/cards";
import type { CartLine, CartView, GiftTierLite } from "@/types/shared";

/**
 * CART CORE — the single source of truth for cart maths. Used by the /api/v1/cart routes, the store layout
 * (header count / flyout) and checkout. Every total is recomputed from DB prices; the client never sends
 * prices. Owners: a signed-in user (Cart.userId) or a guest (Cart.guestToken ↔ httpOnly cookie `tbb_cart`).
 */

export const MAX_QTY = 10;

/**
 * Who owns the cart for this request. `issuedToken` is set by getOrCreateCart() when it had to create a new
 * guest cart — the caller must persist it in the `tbb_cart` cookie (see owner.ts → cartResponse()).
 */
export type CartOwner = { userId: string | null; guestToken: string | null; issuedToken?: string | null };

const itemSelect = {
  productId: true,
  qty: true,
  savedForLater: true,
  addedAt: true,
  product: { select: { ...productCardSelect, status: true } },
} satisfies Prisma.CartItemSelect;

const cartSelect = {
  id: true,
  userId: true,
  couponCode: true,
  giftIds: true,
  items: { select: itemSelect, orderBy: { addedAt: "desc" } },
} satisfies Prisma.CartSelect;

type CartRow = Prisma.CartGetPayload<{ select: typeof cartSelect }>;

// ───────────────────────────── gift tiers ─────────────────────────────

/** Active gift tiers, ascending. Cached (admin edits call invalidate(TAGS.gifts)). */
export async function getGiftTiers(): Promise<GiftTierLite[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.gifts);
  const tiers = await db.giftTier.findMany({
    where: { isActive: true },
    orderBy: { minAmount: "asc" },
    select: { minAmount: true, giftCount: true },
  });
  return tiers;
}

/** How many free gifts a subtotal unlocks (0 for an empty cart). */
export function giftAllowanceFor(subtotal: number, tiers: GiftTierLite[]): number {
  if (subtotal <= 0) return 0;
  let count = 0;
  for (const t of tiers) if (subtotal >= t.minAmount) count = Math.max(count, t.giftCount);
  return count;
}

/** The next tier that would unlock more gifts, or null at the top tier. */
export function nextGiftTier(subtotal: number, tiers: GiftTierLite[]): GiftTierLite | null {
  const allowance = giftAllowanceFor(subtotal, tiers);
  return tiers.find((t) => t.minAmount > subtotal && t.giftCount > allowance) ?? null;
}

export function shippingFeeFor(subtotal: number): number {
  return subtotal === 0 || subtotal >= site.freeShippingMin ? 0 : site.shippingFee;
}

// ───────────────────────────── reading ─────────────────────────────

async function findCartRow(owner: CartOwner): Promise<CartRow | null> {
  if (owner.userId) return db.cart.findUnique({ where: { userId: owner.userId }, select: cartSelect });
  if (owner.guestToken) {
    const cart = await db.cart.findUnique({ where: { guestToken: owner.guestToken }, select: cartSelect });
    return cart && !cart.userId ? cart : null; // a guest token never opens a user's cart
  }
  return null;
}

async function findCartId(owner: CartOwner): Promise<string | null> {
  if (owner.userId) return (await db.cart.findUnique({ where: { userId: owner.userId }, select: { id: true } }))?.id ?? null;
  if (owner.guestToken) {
    const c = await db.cart.findUnique({ where: { guestToken: owner.guestToken }, select: { id: true, userId: true } });
    return c && !c.userId ? c.id : null;
  }
  return null;
}

export function emptyCartView(tiers: GiftTierLite[] = []): CartView {
  return {
    id: "",
    lines: [],
    saved: [],
    count: 0,
    subtotal: 0,
    mrpTotal: 0,
    savings: 0,
    shippingFee: 0,
    giftAllowance: 0,
    nextTier: nextGiftTier(0, tiers),
    giftIds: [],
    couponCode: null,
  };
}

/**
 * Builds the CartView from a cart row. Self-heals the stored cart so checkout sees the same thing:
 * unavailable products (not ACTIVE / out of stock) move to "saved for later", quantities are clamped to
 * stock and the 10-per-item cap, and chosen gifts are dropped if inactive, out of stock or over allowance.
 */
async function buildView(cart: CartRow): Promise<CartView> {
  const tiers = await getGiftTiers();
  const lines: CartLine[] = [];
  const saved: CartLine[] = [];
  const fixes: Prisma.PrismaPromise<unknown>[] = [];

  for (const it of cart.items) {
    const p = it.product;
    const available = p.status === "ACTIVE" && p.stock > 0;
    let savedForLater = it.savedForLater;
    let qty = Math.max(1, it.qty);
    if (!available && !savedForLater) {
      savedForLater = true;
      fixes.push(db.cartItem.update({ where: { cartId_productId: { cartId: cart.id, productId: it.productId } }, data: { savedForLater: true } }));
    }
    const cap = Math.max(1, Math.min(MAX_QTY, p.stock));
    if (available && qty > cap) {
      qty = cap;
      fixes.push(db.cartItem.update({ where: { cartId_productId: { cartId: cart.id, productId: it.productId } }, data: { qty } }));
    }
    const line: CartLine = { productId: it.productId, qty, savedForLater, lineTotal: p.price * qty, product: toProductCard(p) };
    (savedForLater ? saved : lines).push(line);
  }

  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const mrpTotal = lines.reduce((a, l) => a + Math.max(l.product.mrp, l.product.price) * l.qty, 0);
  const giftAllowance = giftAllowanceFor(subtotal, tiers);

  let giftIds = [...new Set(cart.giftIds)];
  if (giftIds.length) {
    const valid = await db.giftItem.findMany({ where: { id: { in: giftIds }, isActive: true, stock: { gt: 0 } }, select: { id: true } });
    const ok = new Set(valid.map((g) => g.id));
    giftIds = giftIds.filter((id) => ok.has(id)).slice(0, giftAllowance);
  }
  if (giftIds.length !== cart.giftIds.length || giftIds.some((id, i) => id !== cart.giftIds[i])) {
    fixes.push(db.cart.update({ where: { id: cart.id }, data: { giftIds } }));
  }
  if (fixes.length) await db.$transaction(fixes);

  return {
    id: cart.id,
    lines,
    saved,
    count: lines.reduce((a, l) => a + l.qty, 0),
    subtotal,
    mrpTotal,
    savings: Math.max(0, mrpTotal - subtotal),
    shippingFee: shippingFeeFor(subtotal),
    giftAllowance,
    nextTier: nextGiftTier(subtotal, tiers),
    giftIds,
    couponCode: cart.couponCode,
  };
}

/** The owner's cart as a CartView (an empty view when they have no cart yet — GET never creates rows). */
export async function getCartView(owner: CartOwner): Promise<CartView> {
  const cart = await findCartRow(owner);
  if (!cart) return emptyCartView(await getGiftTiers());
  return buildView(cart);
}

async function viewById(cartId: string): Promise<CartView> {
  const cart = await db.cart.findUnique({ where: { id: cartId }, select: cartSelect });
  if (!cart) return emptyCartView(await getGiftTiers());
  return buildView(cart);
}

// ───────────────────────────── writing ─────────────────────────────

/**
 * Returns the owner's cart id, creating the cart if needed. For guests without a (valid) token a new guest
 * cart is created and `owner.issuedToken` / `owner.guestToken` are set — persist it as the `tbb_cart` cookie.
 */
export async function getOrCreateCart(owner: CartOwner): Promise<{ cartId: string }> {
  if (owner.userId) {
    const cart = await db.cart.upsert({ where: { userId: owner.userId }, update: {}, create: { userId: owner.userId }, select: { id: true } });
    return { cartId: cart.id };
  }
  if (owner.guestToken) {
    const cart = await db.cart.findUnique({ where: { guestToken: owner.guestToken }, select: { id: true, userId: true } });
    if (cart && !cart.userId) return { cartId: cart.id };
  }
  const token = randomToken(24);
  const cart = await db.cart.create({ data: { guestToken: token }, select: { id: true } });
  owner.guestToken = token;
  owner.issuedToken = token;
  return { cartId: cart.id };
}

type StockInfo = { id: string; name: string; status: string; stock: number };

async function loadProduct(productId: string): Promise<StockInfo> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, name: true, status: true, stock: true } });
  if (!product) throw err.notFound("Product not found");
  return product;
}

function assertBuyable(p: StockInfo) {
  if (p.status !== "ACTIVE") throw err.conflict("This product is currently unavailable");
  if (p.stock <= 0) throw err.conflict("Sorry — this product just went out of stock");
}

const capFor = (p: StockInfo) => Math.min(MAX_QTY, p.stock);

/** Add `qty` (1–10) of a product. Moves it back from "saved for later" if it was there. Stock-checked. */
export async function addItem(owner: CartOwner, productId: string, qty = 1): Promise<CartView> {
  const product = await loadProduct(productId);
  assertBuyable(product);
  const { cartId } = await getOrCreateCart(owner);
  const key = { cartId_productId: { cartId, productId } };
  const existing = await db.cartItem.findUnique({ where: key, select: { qty: true, savedForLater: true } });
  const current = existing && !existing.savedForLater ? existing.qty : 0;
  const cap = capFor(product);
  if (current >= cap) {
    throw err.conflict(
      cap === MAX_QTY
        ? `You can buy up to ${MAX_QTY} of this item per order`
        : `Only ${product.stock} left in stock — ${product.stock === 1 ? "it's" : "they're all"} already in your cart`,
    );
  }
  const next = Math.min(cap, current + Math.max(1, Math.floor(qty)));
  await db.cartItem.upsert({
    where: key,
    create: { cartId, productId, qty: next },
    update: { qty: next, savedForLater: false },
  });
  return viewById(cartId);
}

async function requireItem(owner: CartOwner, productId: string) {
  const cartId = await findCartId(owner);
  if (!cartId) throw err.notFound("Your cart is empty");
  const item = await db.cartItem.findUnique({ where: { cartId_productId: { cartId, productId } }, select: { qty: true, savedForLater: true } });
  if (!item) throw err.notFound("This item isn't in your cart");
  return { cartId, item };
}

/** Set an exact quantity (0 removes). Clamped to stock and the 10-per-item cap. */
export async function setQty(owner: CartOwner, productId: string, qty: number): Promise<CartView> {
  const { cartId } = await requireItem(owner, productId);
  const key = { cartId_productId: { cartId, productId } };
  if (qty <= 0) {
    await db.cartItem.delete({ where: key });
    return viewById(cartId);
  }
  const product = await loadProduct(productId);
  assertBuyable(product);
  await db.cartItem.update({ where: key, data: { qty: Math.min(capFor(product), Math.floor(qty)) } });
  return viewById(cartId);
}

/** Remove a product from the cart (idempotent). */
export async function removeItem(owner: CartOwner, productId: string): Promise<CartView> {
  const cartId = await findCartId(owner);
  if (!cartId) return getCartView(owner);
  await db.cartItem.deleteMany({ where: { cartId, productId } });
  return viewById(cartId);
}

/** Move a line to / from "saved for later". Moving back into the cart re-checks stock. */
export async function setSavedForLater(owner: CartOwner, productId: string, saved: boolean): Promise<CartView> {
  const { cartId, item } = await requireItem(owner, productId);
  const key = { cartId_productId: { cartId, productId } };
  if (saved) {
    await db.cartItem.update({ where: key, data: { savedForLater: true } });
  } else {
    const product = await loadProduct(productId);
    assertBuyable(product);
    await db.cartItem.update({ where: key, data: { savedForLater: false, qty: Math.min(capFor(product), Math.max(1, item.qty)) } });
  }
  return viewById(cartId);
}

/**
 * Choose the free TBB gifts (before payment). Every id must be an active, in-stock GiftItem and the count
 * may not exceed the allowance the current subtotal unlocks (GiftTier).
 */
export async function setGiftIds(owner: CartOwner, giftIds: string[]): Promise<CartView> {
  const ids = [...new Set(giftIds)];
  const cart = await findCartRow(owner);
  if (!cart) {
    if (ids.length) throw err.unprocessable("Add a product to your cart to choose your free gifts");
    return emptyCartView(await getGiftTiers());
  }
  const view = await buildView(cart);
  if (ids.length > view.giftAllowance) {
    throw err.unprocessable(
      view.giftAllowance === 0
        ? "Add a product to your cart to unlock a free gift"
        : `Your cart unlocks ${view.giftAllowance} free gift${view.giftAllowance === 1 ? "" : "s"}${view.nextTier ? ` — add ₹${(view.nextTier.minAmount - view.subtotal).toLocaleString("en-IN")} more for ${view.nextTier.giftCount}` : ""}`,
      { allowance: view.giftAllowance },
    );
  }
  if (ids.length) {
    const gifts = await db.giftItem.findMany({ where: { id: { in: ids } }, select: { id: true, isActive: true, stock: true, miniName: true } });
    const byId = new Map(gifts.map((g) => [g.id, g]));
    for (const id of ids) {
      const g = byId.get(id);
      if (!g || !g.isActive) throw err.unprocessable("That gift is no longer available", { giftId: id });
      if (g.stock <= 0) throw err.unprocessable(`${g.miniName} just ran out — please pick another gift`, { giftId: id });
    }
  }
  await db.cart.update({ where: { id: cart.id }, data: { giftIds: ids } });
  return viewById(cart.id);
}

/** Lightweight count for badges. */
export async function getCartCount(owner: CartOwner): Promise<number> {
  const cartId = await findCartId(owner);
  if (!cartId) return 0;
  const agg = await db.cartItem.aggregate({ where: { cartId, savedForLater: false }, _sum: { qty: true } });
  return agg._sum.qty ?? 0;
}
