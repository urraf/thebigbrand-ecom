import { route } from "@/lib/api";
import { getDashboard } from "@/server/admin/core/dashboard";

/**
 * GET /api/v1/admin/dashboard — KPIs (sales today/MTD, ad revenue MTD, orders today, AOV, gift→full-size
 * conversion), pending approvals, 30-day revenue series (product sales vs ad revenue), recent orders,
 * low stock, top products and the needs-attention list. Auth: admin (ADMIN/STAFF).
 */
export const GET = route({ auth: "admin" }, async () => getDashboard());
