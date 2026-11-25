import { parseBody, route } from "@/lib/api";
import { MessagePatch, setMessageStatus } from "@/server/support/contact";

/** PATCH /api/v1/admin/messages/:id { status: "NEW" | "REPLIED" | "CLOSED" } */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const { status } = await parseBody(req, MessagePatch);
  return setMessageStatus(params.id, status, auth!.user.id);
});
