import { parseBody, route } from "@/lib/api";
import { ApprovalBody, decideApproval } from "@/server/admin/core/products";

/** POST /api/v1/admin/approvals/:productId { action: "approve" } | { action: "reject", reason } — PENDING → ACTIVE / REJECTED. */
export const POST = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, ApprovalBody);
  return decideApproval(params.id, body, auth!.user.id);
});
