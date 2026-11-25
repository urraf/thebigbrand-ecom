import "server-only";
import { db } from "@/lib/db";

export type PendingCounts = {
  approvals: number; // seller products awaiting approval
  campaigns: number; // ad campaigns awaiting review
  sellers: number; // seller applications
  newOrders: number; // paid orders not yet confirmed
  messages: number; // contact-form messages not yet answered
};

/** Sidebar badges + dashboard "needs attention" counts. */
export async function getPendingCounts(): Promise<PendingCounts> {
  const [approvals, campaigns, sellers, newOrders, messages] = await Promise.all([
    db.product.count({ where: { status: "PENDING" } }),
    db.adCampaign.count({ where: { status: "PENDING_REVIEW" } }),
    db.seller.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: "PLACED" } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  return { approvals, campaigns, sellers, newOrders, messages };
}

/** Badge per sidebar href (only non-zero entries). */
export function navBadges(c: PendingCounts): Record<string, { n: number; label: string; tone?: "new" }> {
  const out: Record<string, { n: number; label: string; tone?: "new" }> = {};
  if (c.approvals) out["/admin/approvals"] = { n: c.approvals, label: `${c.approvals} awaiting approval` };
  if (c.campaigns) out["/admin/campaigns"] = { n: c.campaigns, label: `${c.campaigns} awaiting review` };
  if (c.sellers) out["/admin/sellers"] = { n: c.sellers, label: `${c.sellers} applications` };
  if (c.messages) out["/admin/messages"] = { n: c.messages, label: `${c.messages} unanswered`, tone: "new" };
  if (c.newOrders) out["/admin/orders"] = { n: c.newOrders, label: `${c.newOrders} new`, tone: "new" };
  return out;
}
