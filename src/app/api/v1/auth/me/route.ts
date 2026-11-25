import { db } from "@/lib/db";
import { route } from "@/lib/api";

/**
 * GET /api/v1/auth/me — the signed-in user of the request's area (store by default; `x-tbb-scope: seller|admin`
 * for the portal / console), null when signed out there, plus seller status if any.
 */
export const GET = route({ auth: "public" }, async ({ auth }) => {
  if (!auth) return { user: null };
  const seller =
    auth.user.role === "SELLER"
      ? await db.seller.findUnique({ where: { userId: auth.user.id }, select: { id: true, slug: true, status: true, displayName: true } })
      : null;
  return { user: auth.user, seller };
});
