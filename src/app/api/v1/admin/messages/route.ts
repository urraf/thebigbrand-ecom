import { parseQuery, route } from "@/lib/api";
import { listMessages, MessageListQuery } from "@/server/support/contact";

/** GET /api/v1/admin/messages?status=NEW&topic=order&q=&page= — contact-form inbox (paged). */
export const GET = route({ auth: "admin" }, async ({ req }) => listMessages(parseQuery(req, MessageListQuery)));
