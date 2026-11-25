import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { markOrderRefunded } from "@/server/admin/core/orders";

const Body = z.object({ note: z.string().trim().max(200).optional() });

/** POST /api/v1/admin/orders/:number/refund { note? } — record the refund of a paid order that was cancelled/returned. */
export const POST = route<{ number: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const { note } = await parseBody(req, Body);
  return markOrderRefunded(params.number, auth!.user.id, note);
});
