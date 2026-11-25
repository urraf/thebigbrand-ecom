import "server-only";
import type { CampaignStatus } from "@/lib/db";

/**
 * Delivery state of a campaign as the shopper experiences it (status alone is not enough:
 * an APPROVED campaign may be scheduled, finished, out of budget, or in a paused slot).
 * live = APPROVED ∧ slot active ∧ startsAt ≤ now ≤ endsAt ∧ (budget = 0 ∨ spent < budget)
 */
export type DeliveryState =
  | "LIVE"
  | "SCHEDULED"
  | "FINISHED"
  | "BUDGET_SPENT"
  | "SLOT_PAUSED"
  | "PENDING_REVIEW"
  | "DRAFT"
  | "PAUSED"
  | "REJECTED"
  | "ENDED";

export type StateInput = {
  status: CampaignStatus;
  startsAt: Date;
  endsAt: Date;
  budget: number;
  spent: number;
  slot: { isActive: boolean };
};

export function deliveryState(c: StateInput, now = new Date()): DeliveryState {
  switch (c.status) {
    case "APPROVED":
      if (c.endsAt < now) return "FINISHED";
      if (c.startsAt > now) return "SCHEDULED";
      if (c.budget > 0 && c.spent >= c.budget) return "BUDGET_SPENT";
      if (!c.slot.isActive) return "SLOT_PAUSED";
      return "LIVE";
    default:
      return c.status;
  }
}

export const isLiveNow = (c: StateInput, now = new Date()) => deliveryState(c, now) === "LIVE";

/** Prisma filter for campaigns serving right now (budget check is done in JS since it compares two columns). */
export function liveWhere(now = new Date()) {
  return { status: "APPROVED" as const, startsAt: { lte: now }, endsAt: { gte: now }, slot: { isActive: true } };
}

export const STATE_LABEL: Record<DeliveryState, string> = {
  LIVE: "Live",
  SCHEDULED: "Scheduled",
  FINISHED: "Finished",
  BUDGET_SPENT: "Budget spent",
  SLOT_PAUSED: "Slot paused",
  PENDING_REVIEW: "Awaiting approval",
  DRAFT: "Draft",
  PAUSED: "Paused",
  REJECTED: "Rejected",
  ENDED: "Ended",
};

/** Pill colour key used by the UI. */
export const STATE_TONE: Record<DeliveryState, "live" | "pending" | "info" | "muted" | "crit" | "warn"> = {
  LIVE: "live",
  SCHEDULED: "info",
  FINISHED: "muted",
  BUDGET_SPENT: "warn",
  SLOT_PAUSED: "warn",
  PENDING_REVIEW: "pending",
  DRAFT: "muted",
  PAUSED: "warn",
  REJECTED: "crit",
  ENDED: "muted",
};
