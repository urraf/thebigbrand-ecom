import { parseBody, route } from "@/lib/api";
import { addOrderNote, OrderNoteBody } from "@/server/admin/core/orders";

/** POST /api/v1/admin/orders/:number/notes { note } — internal note on the order timeline. */
export const POST = route<{ number: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const { note } = await parseBody(req, OrderNoteBody);
  return addOrderNote(params.number, note, auth!.user.id);
});
