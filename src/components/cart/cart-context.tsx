"use client";
/**
 * CART + STORE CLIENT STATE (owner: store-kit).
 *
 * <CartProvider initial={cartView?}> is mounted once in the store layout. The per-user session (cart,
 * user, wishlist, deliver-to) streams in through <HydrateStore> (rendered inside a <Suspense> boundary), so
 * the static shell never waits on cookies.
 *
 * useCart() → { cart, count, busy, ready, add(productId, qty?), addItem(...) → ok, setQty, remove,
 *               saveForLater(productId, saved), setGifts(giftIds) → ok, refresh(), lastAdded, dismissAdded }
 *   add() POSTs /api/v1/cart with an optimistic count, then opens the "Added to cart" flyout.
 * useStore() → { ready, user, deliverTo, setPincode(pin, city?), isWished(id), toggleWish(id) }
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CartView } from "@/types/shared";
import type { DeliverTo, StoreSessionData, StoreUser } from "@/server/cart/session";
import { toast } from "@/components/ui/toast";

export type CartApi = {
  cart: CartView | null;
  count: number;
  busy: boolean;
  add: (productId: string, qty?: number) => Promise<void>;
  setQty: (productId: string, qty: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  saveForLater: (productId: string, saved: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  // ── additions (backwards compatible) ──
  /** true once the server cart has been loaded/hydrated */
  ready: boolean;
  /** like add() but resolves to whether it succeeded (errors are toasted either way) */
  addItem: (productId: string, qty?: number, opts?: { silent?: boolean }) => Promise<boolean>;
  /** PUT /api/v1/cart/gifts — resolves false (and toasts) when the server rejects the choice */
  setGifts: (giftIds: string[]) => Promise<boolean>;
  /** the last successful add (drives the flyout) */
  lastAdded: { productId: string; qty: number; at: number } | null;
  /** whether the Added-to-cart flyout is open */
  addedOpen: boolean;
  dismissAdded: () => void;
};

export type StoreApi = {
  ready: boolean;
  user: StoreUser | null;
  deliverTo: DeliverTo | null;
  setPincode: (pincode: string, city?: string | null) => void;
  isWished: (productId: string) => boolean;
  toggleWish: (productId: string) => Promise<void>;
};

const noop = async () => {};
const CartCtx = createContext<CartApi>({
  cart: null,
  count: 0,
  busy: false,
  add: noop,
  setQty: noop,
  remove: noop,
  saveForLater: noop,
  refresh: noop,
  ready: false,
  addItem: async () => false,
  setGifts: async () => false,
  lastAdded: null,
  addedOpen: false,
  dismissAdded: () => {},
});
const StoreCtx = createContext<StoreApi>({
  ready: false,
  user: null,
  deliverTo: null,
  setPincode: () => {},
  isWished: () => false,
  toggleWish: noop,
});
const HydrateCtx = createContext<(data: StoreSessionData) => void>(() => {});

export const useCart = () => useContext(CartCtx);
export const useStore = () => useContext(StoreCtx);

// ───────────────────────────── helpers ─────────────────────────────

class ApiFailure extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: { data?: T; error?: { message?: string } } | null = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiFailure(res.status, body?.error?.message ?? "Something went wrong — please try again");
  return body?.data as T;
}

const PIN_KEY = "tbb_pin";
const PIN_EVENT = "tbb:pin";
const PINCODE = /^[1-9][0-9]{5}$/;

function subscribePin(cb: () => void) {
  window.addEventListener(PIN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PIN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readPinRaw(): string | null {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}
function parsePin(raw: string | null): { pincode: string; city: string | null } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { pincode?: string; city?: string | null };
    return v.pincode && PINCODE.test(v.pincode) ? { pincode: v.pincode, city: v.city ?? null } : null;
  } catch {
    return null;
  }
}

/** Local optimistic edit of a CartView (server response replaces it a moment later). */
function patchView(view: CartView, productId: string, fn: (qty: number, saved: boolean) => { qty: number; saved: boolean } | null): CartView {
  const all = [...view.lines, ...view.saved];
  const next = all
    .map((l) => {
      if (l.productId !== productId) return l;
      const r = fn(l.qty, l.savedForLater);
      return r ? { ...l, qty: r.qty, savedForLater: r.saved, lineTotal: l.product.price * r.qty } : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const lines = next.filter((l) => !l.savedForLater);
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const mrpTotal = lines.reduce((a, l) => a + Math.max(l.product.mrp, l.product.price) * l.qty, 0);
  return {
    ...view,
    lines,
    saved: next.filter((l) => l.savedForLater),
    count: lines.reduce((a, l) => a + l.qty, 0),
    subtotal,
    mrpTotal,
    savings: Math.max(0, mrpTotal - subtotal),
  };
}

// ───────────────────────────── provider ─────────────────────────────

export function CartProvider({ children, initial = null }: { children: React.ReactNode; initial?: CartView | null }) {
  const [cart, setCartState] = useState<CartView | null>(initial);
  const [pendingAdds, setPendingAdds] = useState(0);
  const [busyCount, setBusyCount] = useState(0);
  const [lastAdded, setLastAdded] = useState<CartApi["lastAdded"]>(null);
  const [addedOpen, setAddedOpen] = useState(false);
  const [user, setUser] = useState<StoreUser | null>(null);
  const [ready, setReady] = useState(initial !== null);
  const [wish, setWishState] = useState<Set<string>>(() => new Set());
  const [serverDeliverTo, setServerDeliverTo] = useState<DeliverTo | null>(null);
  const pinRaw = useSyncExternalStore(subscribePin, readPinRaw, () => null);
  const localPin = useMemo(() => parsePin(pinRaw), [pinRaw]);

  // mirrors of state for use inside async handlers (always written together with the state)
  const cartRef = useRef<CartView | null>(initial);
  const wishRef = useRef<Set<string>>(new Set());
  const seq = useRef(0); // latest mutation id — older responses are ignored
  const inflight = useRef(0);
  const mutated = useRef(false); // a mutation finished before the first hydration arrived
  const hydrations = useRef(0);
  const userRef = useRef<StoreUser | null | undefined>(undefined); // undefined = unknown yet

  const setCart = useCallback((v: CartView | null) => {
    cartRef.current = v;
    setCartState(v);
  }, []);
  const setWish = useCallback((v: Set<string>) => {
    wishRef.current = v;
    setWishState(v);
  }, []);

  const hydrate = useCallback((data: StoreSessionData) => {
    const first = hydrations.current === 0;
    hydrations.current += 1;
    userRef.current = data.user;
    setUser(data.user);
    setWish(new Set(data.wishIds));
    setServerDeliverTo(data.deliverTo);
    // keep a fresher client cart if the shopper already changed it before the stream arrived
    if (inflight.current === 0 && !(first && mutated.current)) setCart(data.cart);
    setReady(true);
  }, [setCart, setWish]);

  /** Runs a cart mutation: optimistic update → request → apply the server view (if still the latest). */
  const mutate = useCallback(
    async (request: () => Promise<CartView>, optimistic?: (v: CartView) => CartView): Promise<CartView | null> => {
      const id = ++seq.current;
      inflight.current += 1;
      setBusyCount((n) => n + 1);
      const before = cartRef.current;
      if (optimistic && before) setCart(optimistic(before));
      try {
        const view = await request();
        mutated.current = true;
        if (id === seq.current) setCart(view);
        setReady(true);
        return view;
      } catch (e) {
        if (optimistic && before && id === seq.current) setCart(before);
        const msg = e instanceof Error ? e.message : "Something went wrong — please try again";
        toast(msg, { icon: "info" });
        return null;
      } finally {
        inflight.current -= 1;
        setBusyCount((n) => n - 1);
      }
    },
    [setCart],
  );

  const addItem = useCallback(
    // silent: no "Added to cart" flyout (Buy now leaves the page right away — the flyout would sit on top of
    // the checkout / sign-in page)
    async (productId: string, qty = 1, opts?: { silent?: boolean }) => {
      setPendingAdds((n) => n + qty);
      const view = await mutate(() => api<CartView>("/api/v1/cart", { method: "POST", body: JSON.stringify({ productId, qty }) }));
      setPendingAdds((n) => n - qty);
      if (view && !opts?.silent) {
        setLastAdded({ productId, qty, at: Date.now() });
        setAddedOpen(true);
      }
      return view !== null;
    },
    [mutate],
  );

  const add = useCallback(async (productId: string, qty = 1) => {
    await addItem(productId, qty);
  }, [addItem]);

  const setQty = useCallback(
    async (productId: string, qty: number) => {
      const q = Math.max(0, Math.min(10, Math.floor(qty)));
      await mutate(
        () => api<CartView>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify({ qty: q }) }),
        (v) => patchView(v, productId, (_, saved) => (q === 0 ? null : { qty: q, saved })),
      );
    },
    [mutate],
  );

  const remove = useCallback(
    async (productId: string) => {
      await mutate(
        () => api<CartView>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, { method: "DELETE" }),
        (v) => patchView(v, productId, () => null),
      );
    },
    [mutate],
  );

  const saveForLater = useCallback(
    async (productId: string, saved: boolean) => {
      await mutate(
        () => api<CartView>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify({ savedForLater: saved }) }),
        (v) => patchView(v, productId, (qty) => ({ qty, saved })),
      );
    },
    [mutate],
  );

  const setGifts = useCallback(
    async (giftIds: string[]) => {
      const view = await mutate(
        () => api<CartView>("/api/v1/cart/gifts", { method: "PUT", body: JSON.stringify({ giftIds }) }),
        (v) => ({ ...v, giftIds }),
      );
      return view !== null;
    },
    [mutate],
  );

  const refresh = useCallback(async () => {
    try {
      const view = await api<CartView>("/api/v1/cart");
      setCart(view);
      setReady(true);
    } catch {
      /* keep the current state */
    }
  }, [setCart]);

  // no streamed session (e.g. provider used outside the store layout) → load the cart client-side
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      if (hydrations.current === 0 && inflight.current === 0) void refresh();
    }, 2500);
    return () => clearTimeout(t);
  }, [ready, refresh]);

  const dismissAdded = useCallback(() => setAddedOpen(false), []);

  // ── wishlist ──
  const toggleWish = useCallback(
    async (productId: string) => {
      const signIn = () =>
        toast("Sign in to save products to your wishlist", {
          icon: "heart",
          action: { href: `/login?next=${encodeURIComponent(location.pathname + location.search)}`, label: "Sign in" },
        });
      if (userRef.current === null) return signIn();
      const prev = wishRef.current;
      const wasOn = prev.has(productId);
      const next = new Set(prev);
      if (wasOn) next.delete(productId);
      else next.add(productId);
      setWish(next);
      try {
        const res = wasOn
          ? await api<{ ids: string[] }>(`/api/v1/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" })
          : await api<{ ids: string[] }>("/api/v1/wishlist", { method: "POST", body: JSON.stringify({ productId }) });
        setWish(new Set(res.ids));
        toast(wasOn ? "Removed from your wishlist" : "Saved to your wishlist", {
          icon: "heart",
          ...(wasOn ? {} : { action: { href: "/account/wishlist", label: "View" } }),
        });
      } catch (e) {
        setWish(prev);
        if (e instanceof ApiFailure && e.status === 401) {
          userRef.current = null;
          signIn();
        } else {
          toast(e instanceof Error ? e.message : "Couldn't update your wishlist", { icon: "info" });
        }
      }
    },
    [setWish],
  );

  const isWished = useCallback((id: string) => wish.has(id), [wish]);

  const setPincode = useCallback((pincode: string, city: string | null = null) => {
    if (!PINCODE.test(pincode)) return;
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify({ pincode, city }));
    } catch {
      /* private mode: nothing to persist */
    }
    window.dispatchEvent(new Event(PIN_EVENT));
  }, []);

  const deliverTo = useMemo<DeliverTo | null>(() => {
    if (localPin) {
      const sameAsSaved = serverDeliverTo?.pincode === localPin.pincode;
      return { name: user?.firstName ?? null, city: localPin.city ?? (sameAsSaved ? serverDeliverTo!.city : null), pincode: localPin.pincode };
    }
    return serverDeliverTo;
  }, [localPin, serverDeliverTo, user]);

  const count = (cart?.count ?? 0) + pendingAdds;

  const cartApi = useMemo<CartApi>(
    () => ({ cart, count, busy: busyCount > 0, add, setQty, remove, saveForLater, refresh, ready, addItem, setGifts, lastAdded, addedOpen, dismissAdded }),
    [cart, count, busyCount, add, setQty, remove, saveForLater, refresh, ready, addItem, setGifts, lastAdded, addedOpen, dismissAdded],
  );
  const storeApi = useMemo<StoreApi>(
    () => ({ ready, user, deliverTo, setPincode, isWished, toggleWish }),
    [ready, user, deliverTo, setPincode, isWished, toggleWish],
  );

  return (
    <HydrateCtx.Provider value={hydrate}>
      <StoreCtx.Provider value={storeApi}>
        <CartCtx.Provider value={cartApi}>{children}</CartCtx.Provider>
      </StoreCtx.Provider>
    </HydrateCtx.Provider>
  );
}

/** Pushes the streamed per-user session into the provider (render inside <Suspense>, from a Server Component). */
export function HydrateStore({ data }: { data: StoreSessionData }) {
  const hydrate = useContext(HydrateCtx);
  useEffect(() => {
    hydrate(data);
  }, [data, hydrate]);
  return null;
}
