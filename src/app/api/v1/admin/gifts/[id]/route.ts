import { parseBody, route } from "@/lib/api";
import { deleteGift, GiftPatch, updateGift } from "@/server/admin/core/gifts";

/** PATCH /api/v1/admin/gifts/:id { miniName?, miniSize?, worth?, stock?, addStock?, isActive?, sortOrder? } — addStock restocks (+n). */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => updateGift(params.id, await parseBody(req, GiftPatch), auth!.user.id));

/** DELETE /api/v1/admin/gifts/:id — only minis never given in an order (otherwise switch them off). */
export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, auth }) => deleteGift(params.id, auth!.user.id));
