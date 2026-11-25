import { parseBody, route } from "@/lib/api";
import { sellerAction, sellerActionSchema } from "@/server/admin/growth/sellers";

/**
 * POST /api/v1/admin/sellers/:id/action (admin)
 *   { action: "approve" }              PENDING|REJECTED → APPROVED (approvedAt, user role SELLER)
 *   { action: "reject", reason }       PENDING → REJECTED
 *   { action: "suspend", reason }      APPROVED → SUSPENDED (their live products are taken off the store)
 *   { action: "reactivate" }           SUSPENDED → APPROVED (products restored)
 */
export const POST = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const { action, reason } = await parseBody(req, sellerActionSchema);
  return sellerAction(params.id, action, reason, auth!.user.id);
});
