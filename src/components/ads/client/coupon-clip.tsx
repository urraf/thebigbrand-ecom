"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "@/components/cart/cart-context";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/toast";

/**
 * H9 coupon wall — clip buttons + "n clipped" counter. Clipped ids are loaded once for a signed-in shopper
 * (GET /api/v1/ads/coupons); clipping POSTs /api/v1/ads/coupons/[id]/clip (DELETE to unclip). Signed-out
 * shoppers get a sign-in prompt.
 */
type State = { clipped: Set<string>; loaded: boolean; busy: Set<string> };
let state: State = { clipped: new Set(), loaded: false, busy: new Set() };
const subs = new Set<() => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const snapshot = () => state;
let loading: Promise<void> | null = null;

function load() {
  if (state.loaded || loading) return;
  loading = fetch("/api/v1/ads/coupons", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((j: { data?: { clipped: string[] | null } }) => emit({ clipped: new Set(j.data?.clipped ?? []), loaded: true }))
    .catch(() => {})
    .finally(() => (loading = null));
}

function signInPrompt() {
  const next = typeof location !== "undefined" ? location.pathname + location.search : "/";
  toast("Sign in to clip coupons — they apply automatically at checkout", { icon: "scissors", action: { href: `/login?next=${encodeURIComponent(next)}`, label: "Sign in" } });
}

async function toggle(couponId: string, label: string) {
  if (state.busy.has(couponId)) return;
  const on = !state.clipped.has(couponId);
  const optimistic = new Set(state.clipped);
  if (on) optimistic.add(couponId);
  else optimistic.delete(couponId);
  const busy = new Set(state.busy).add(couponId);
  const before = state.clipped;
  emit({ clipped: optimistic, busy });
  try {
    const res = await fetch(`/api/v1/ads/coupons/${encodeURIComponent(couponId)}/clip`, { method: on ? "POST" : "DELETE", credentials: "same-origin" });
    if (res.status === 401) {
      emit({ clipped: before });
      signInPrompt();
      return;
    }
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!res.ok) {
      emit({ clipped: before });
      toast(j?.error?.message ?? "Couldn't clip that coupon — please try again", { icon: "info" });
      return;
    }
    toast(on ? `${label} clipped — applied automatically at checkout` : `${label} coupon removed`, { icon: on ? "scissors" : "info" });
  } catch {
    emit({ clipped: before });
    toast("You're offline — please try again", { icon: "info" });
  } finally {
    const b = new Set(state.busy);
    b.delete(couponId);
    emit({ busy: b });
  }
}

function useCoupons() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const { ready, user } = useStore();
  useEffect(() => {
    if (ready && user) load();
  }, [ready, user]);
  return s;
}

export function ClipButton({ couponId, label }: { couponId: string; label: string }) {
  const s = useCoupons();
  const { ready, user } = useStore();
  const ref = useRef<HTMLButtonElement>(null);
  const on = s.clipped.has(couponId);
  useEffect(() => {
    ref.current?.closest(".zn-cp")?.classList.toggle("is-on", on);
  }, [on]);
  return (
    <button
      ref={ref}
      type="button"
      className="zn-cp-btn"
      aria-pressed={on}
      aria-busy={s.busy.has(couponId) || undefined}
      aria-label={`${on ? "Unclip" : "Clip"} ${label} coupon`}
      onClick={() => {
        if (ready && !user) return signInPrompt();
        void toggle(couponId, label);
      }}
    >
      {on ? <Icon name="check" /> : <Icon name="scissors" />}
      <span>{on ? "Clipped ✓" : "Clip coupon"}</span>
    </button>
  );
}

export function ClipCount({ ids }: { ids: string[] }) {
  const s = useCoupons();
  const n = ids.filter((id) => s.clipped.has(id)).length;
  return (
    <span className={cx("zn-cp-count", n > 0 && "is-on")} aria-live="polite">
      <Icon name="tag" />
      <b>{n}</b>&nbsp;clipped
    </span>
  );
}
