import { route } from "@/lib/api";
import { getPendingCounts } from "@/server/admin/core/counts";

/** GET /api/v1/admin/dashboard/counts — badge counts { approvals, campaigns, sellers, newOrders } for the admin app. */
export const GET = route({ auth: "admin" }, async () => getPendingCounts());
