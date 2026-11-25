import { parseBody, route } from "@/lib/api";
import { CategoryCreate, createCategory, listCategories } from "@/server/admin/core/brands";

/**
 * GET  /api/v1/admin/categories → categories with product counts
 * POST /api/v1/admin/categories { name, slug?, short?, description?, imageUrl?, parentId?, sortOrder, isActive }
 */
export const GET = route({ auth: "admin" }, async () => ({ items: await listCategories() }));

export const POST = route({ auth: "admin" }, async ({ req, auth }) => createCategory(await parseBody(req, CategoryCreate), auth!.user.id));
