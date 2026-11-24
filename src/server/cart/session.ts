import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getAuth } from "@/lib/auth";
import { db, type Role } from "@/lib/db";
import { COOKIES } from "@/lib/site";
import type { CartView } from "@/types/shared";
import { mergeGuestCart } from "./merge";
import { emptyCartView, getCartView } from "./service";
import { getWishlistIds } from "./wishlist";

/** Per-user bits the store chrome needs (header greeting, cart count, wishlist hearts, deliver-to). */
export type StoreUser = { id: string; name: string | null; firstName: string; role: Role };
export type DeliverTo = { name: string | null; city: string | null; pincode: string };
export type StoreSessionData = {
  user: StoreUser | null;
  cart: CartView;
  wishIds: string[];
  deliverTo: DeliverTo | null;
};

export function firstNameOf(name: string | null | undefined, fallback = "there"): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first.slice(0, 18) : fallback;
}

/**
 * Reads the session + cart for this request. Request-time only (connection + cookies) — call it inside <Suspense>.
 * Memoised per request with React cache(), so the header, tab bar and hydrator share one set of queries.
 * Never throws: on a DB hiccup the chrome falls back to the signed-out view instead of breaking the page.
 */
export const getStoreSession = cache(async (): Promise<StoreSessionData> => {
  // request-time only: verifying the session JWT reads the current time, which Next forbids in prerenders and
  // runtime prefetches ("unstable value `new Date()`"); the live cart count must never be prefetched stale anyway
  await connection();
  try {
    const [auth, jar] = await Promise.all([getAuth(), cookies()]);
    if (!auth) {
      const token = jar.get(COOKIES.cart)?.value ?? null;
      return { user: null, cart: await getCartView({ userId: null, guestToken: token }), wishIds: [], deliverTo: null };
    }
    const u = auth.user;
    // safety net: a sign-in path that didn't merge the guest cart (e.g. a Server Action) still gets it merged
    // here (idempotent, never throws; the stale cookie is cleared by the next /api/v1/cart response)
    const guestToken = jar.get(COOKIES.cart)?.value;
    if (guestToken) await mergeGuestCart(u.id, guestToken);
    const [cart, wishIds, address] = await Promise.all([
      getCartView({ userId: u.id, guestToken: null }),
      getWishlistIds(u.id),
      db.address.findFirst({
        where: { userId: u.id },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { name: true, city: true, pincode: true },
      }),
    ]);
    const display = u.name ?? address?.name ?? null;
    return {
      user: { id: u.id, name: u.name, firstName: firstNameOf(display), role: u.role },
      cart,
      wishIds,
      deliverTo: address ? { name: firstNameOf(address.name ?? u.name), city: address.city, pincode: address.pincode } : null,
    };
  } catch (e) {
    unstable_rethrow(e); // never swallow Next's own control-flow errors
    console.error("[store] session read failed", e);
    return { user: null, cart: emptyCartView(), wishIds: [], deliverTo: null };
  }
});
