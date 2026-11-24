"use client";
/**
 * CART CLIENT STATE — CONTRACT (implemented by the store-kit build agent; this is a placeholder).
 *
 * <CartProvider initial={cartView}> is mounted once in the store layout.
 * useCart() → { cart, count, add(productId, qty?), setQty(productId, qty), remove(productId),
 *               saveForLater(productId, saved), refresh(), busy }
 * add() POSTs /api/v1/cart, updates state and opens the "Added to cart" flyout.
 */
import { createContext, useContext } from "react";
import type { CartView } from "@/types/shared";

export type CartApi = {
  cart: CartView | null;
  count: number;
  busy: boolean;
  add: (productId: string, qty?: number) => Promise<void>;
  setQty: (productId: string, qty: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  saveForLater: (productId: string, saved: boolean) => Promise<void>;
  refresh: () => Promise<void>;
};

const noop = async () => {};
const CartCtx = createContext<CartApi>({ cart: null, count: 0, busy: false, add: noop, setQty: noop, remove: noop, saveForLater: noop, refresh: noop });

export function CartProvider({ children }: { children: React.ReactNode; initial?: CartView | null }) {
  return <CartCtx.Provider value={{ cart: null, count: 0, busy: false, add: noop, setQty: noop, remove: noop, saveForLater: noop, refresh: noop }}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);
