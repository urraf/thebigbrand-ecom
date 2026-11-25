import { parseBody, route } from "@/lib/api";
import { changeItemStatus, ItemStatusBody } from "@/server/admin/core/orders";

/** POST /api/v1/admin/orders/:number/items/:itemId { to, note?, courier?, trackingNumber? } — move one line (lifecycle). */
export const POST = route<{ number: string; itemId: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const body = await parseBody(req, ItemStatusBody);
  return changeItemStatus(params.number, params.itemId, body, auth!.user.id);
});
