import { clientIp } from "@/lib/auth";
import { err, rateLimit, route } from "@/lib/api";
import { markReviewHelpful } from "@/server/catalog/reviews";

/**
 * POST /api/v1/catalog/reviews/[id]/helpful → { id, helpful, counted }
 * One vote per shopper per review (user id when signed in, else IP + browser); rate-limited.
 */
export const POST = route<{ id: string }>({ auth: "public" }, async ({ req, params, auth }) => {
  if (!/^[a-z0-9]{8,40}$/i.test(params.id)) throw err.notFound("Review not found");
  const ip = clientIp(req) ?? "anon";
  rateLimit(`helpful:${ip}`, 30, 60_000);
  const voter = auth ? `u:${auth.user.id}` : `ip:${ip}:${(req.headers.get("user-agent") ?? "").slice(0, 80)}`;
  const res = await markReviewHelpful(params.id, voter);
  if (!res) throw err.notFound("Review not found");
  return res;
});
