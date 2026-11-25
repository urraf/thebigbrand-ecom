import { parseBody, route } from "@/lib/api";
import { CategoryPatch, deleteCategory, updateCategory } from "@/server/admin/core/brands";

/** PATCH /api/v1/admin/categories/:id — any category fields ({ isActive: false } hides it from the store menus). */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => updateCategory(params.id, await parseBody(req, CategoryPatch), auth!.user.id));

/** DELETE /api/v1/admin/categories/:id — only empty categories. */
export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, auth }) => deleteCategory(params.id, auth!.user.id));
