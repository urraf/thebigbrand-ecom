import { clientIp } from "@/lib/auth";
import { parseBody, rateLimit, route } from "@/lib/api";
import { ContactInput, submitContact } from "@/server/support/contact";

/**
 * POST /api/v1/support/contact { topic, name, email, phone?, orderNumber?, message } → { id, reference, createdAt }
 * Public (signed-in users are linked to the message). 5 messages per 10 minutes per IP.
 */
export const POST = route({ auth: "public" }, async ({ req, auth }) => {
  rateLimit(`contact:${clientIp(req) ?? auth?.user.id ?? "anon"}`, 5, 10 * 60_000);
  const input = await parseBody(req, ContactInput);
  return submitContact(input, { userId: auth?.user.id, ip: clientIp(req) });
});
