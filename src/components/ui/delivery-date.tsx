"use client";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function deliveryLabel(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * "Thu, 26 Nov" — the estimated delivery date. Computed in the browser (the static shell can't contain
 * "today"), with a neutral "in 2 days" during prerender/hydration so there is no mismatch.
 */
export function DeliveryDate({ days = 2 }: { days?: number }) {
  const label = useSyncExternalStore(noopSubscribe, () => deliveryLabel(days), () => null);
  return <b>{label ?? `in ${days} days`}</b>;
}
