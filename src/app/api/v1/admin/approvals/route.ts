import { route } from "@/lib/api";
import { listApprovals } from "@/server/admin/core/products";

/** GET /api/v1/admin/approvals — seller-submitted products awaiting approval (+ recent decisions). */
export const GET = route({ auth: "admin" }, async () => listApprovals());
