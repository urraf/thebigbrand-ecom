import { route } from "@/lib/api";
import { productFormOptions } from "@/server/admin/core/products";

/** GET /api/v1/admin/products/options — brands, categories, sellers, concerns and packshot shapes for filters/forms. */
export const GET = route({ auth: "admin" }, async () => productFormOptions());
