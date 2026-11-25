import { route } from "@/lib/api";
import { getCatalog } from "@/server/catalog/data";

/** GET /api/v1/catalog/concerns → [{ slug, name, emoji, description, sponsor: BrandLite|null, productCount }] */
export const GET = route({ auth: "public" }, async () => (await getCatalog()).concerns);
