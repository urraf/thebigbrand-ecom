import { route } from "@/lib/api";
import { getCatalog } from "@/server/catalog/data";

/** GET /api/v1/catalog/categories → [{ id, slug, name, short, description, imageUrl, productCount }] */
export const GET = route({ auth: "public" }, async () => (await getCatalog()).categories);
