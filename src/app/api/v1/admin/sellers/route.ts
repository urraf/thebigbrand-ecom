import { parseQuery, route } from "@/lib/api";
import { listSellers, sellerListQuery } from "@/server/admin/growth/sellers";

/**
 * GET /api/v1/admin/sellers?status=PENDING|APPROVED|REJECTED|SUSPENDED&q&page&limit (admin)
 * → paged sellers with full KYC + bank details, product counts, 30-day GMV, ledger balance; `counts` per status.
 */
export const GET = route({ auth: "admin" }, async ({ req }) => listSellers(parseQuery(req, sellerListQuery)));
