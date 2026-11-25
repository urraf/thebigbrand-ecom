import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { adminSearch } from "@/server/admin/core/search";

const Query = z.object({ q: z.string().trim().max(80).default("") });

/** GET /api/v1/admin/dashboard/search?q= — console search across orders, products, customers, brands, sellers. */
export const GET = route({ auth: "admin" }, async ({ req }) => {
  const { q } = parseQuery(req, Query);
  return { items: await adminSearch(q) };
});
