/**
 * Status pills (`.am-pill-*`) with the console's tone mapping for every status enum.
 *   <StatusPill kind="order" status="SHIPPED" />    <Pill tone="live">Active</Pill>
 */
import type { ReactNode } from "react";

export type PillTone = "new" | "confirmed" | "packed" | "pending" | "shipped" | "delivered" | "live" | "rejected" | "ended" | "dark";

export function Pill({ tone = "ended", children, title }: { tone?: PillTone; children: ReactNode; title?: string }) {
  return (
    <span className={`am-pill am-pill-${tone}`} title={title}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

type Kind = "order" | "item" | "payment" | "product" | "seller" | "campaign" | "payout";

const MAP: Record<Kind, Record<string, [string, PillTone]>> = {
  order: {
    PENDING_PAYMENT: ["Awaiting payment", "ended"],
    PLACED: ["New", "new"],
    CONFIRMED: ["Confirmed", "confirmed"],
    PACKED: ["Packed", "packed"],
    SHIPPED: ["Shipped", "shipped"],
    OUT_FOR_DELIVERY: ["Out for delivery", "shipped"],
    DELIVERED: ["Delivered", "delivered"],
    CANCELLED: ["Cancelled", "rejected"],
    RETURN_REQUESTED: ["Return requested", "pending"],
    RETURNED: ["Returned", "ended"],
    REFUNDED: ["Refunded", "ended"],
  },
  item: {
    PLACED: ["New", "new"],
    CONFIRMED: ["Confirmed", "confirmed"],
    PACKED: ["Packed", "packed"],
    SHIPPED: ["Shipped", "shipped"],
    DELIVERED: ["Delivered", "delivered"],
    CANCELLED: ["Cancelled", "rejected"],
    RETURNED: ["Returned", "ended"],
  },
  payment: {
    PENDING: ["Pending", "pending"],
    PAID: ["Paid", "live"],
    FAILED: ["Failed", "rejected"],
    REFUNDED: ["Refunded", "ended"],
    COD_PENDING: ["COD · to collect", "packed"],
  },
  product: {
    DRAFT: ["Draft", "ended"],
    PENDING: ["Awaiting approval", "pending"],
    ACTIVE: ["Active", "live"],
    REJECTED: ["Rejected", "rejected"],
    ARCHIVED: ["Archived", "ended"],
  },
  seller: {
    PENDING: ["Pending", "pending"],
    APPROVED: ["Approved", "live"],
    REJECTED: ["Rejected", "rejected"],
    SUSPENDED: ["Suspended", "rejected"],
  },
  campaign: {
    DRAFT: ["Draft", "ended"],
    PENDING_REVIEW: ["Awaiting approval", "pending"],
    APPROVED: ["Approved", "live"],
    PAUSED: ["Paused", "packed"],
    REJECTED: ["Rejected", "rejected"],
    ENDED: ["Ended", "ended"],
  },
  payout: {
    PENDING: ["Pending", "pending"],
    PROCESSING: ["Processing", "shipped"],
    PAID: ["Paid", "live"],
    FAILED: ["Failed", "rejected"],
  },
};

export function statusLabel(kind: Kind, status: string): string {
  return MAP[kind][status]?.[0] ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusPill({ kind, status, label }: { kind: Kind; status: string; label?: string }) {
  const [text, tone] = MAP[kind][status] ?? [statusLabel(kind, status), "ended" as PillTone];
  return <Pill tone={tone}>{label ?? text}</Pill>;
}
