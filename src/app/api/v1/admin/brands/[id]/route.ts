import { parseBody, route } from "@/lib/api";
import { BrandPatch, deleteBrand, updateBrand } from "@/server/admin/core/brands";

/** PATCH /api/v1/admin/brands/:id — any brand fields (e.g. { storeActive: true } switches the paid brand store B1 on). */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => updateBrand(params.id, await parseBody(req, BrandPatch), auth!.user.id));

/** DELETE /api/v1/admin/brands/:id — only brands with no products, campaigns, coupons or advertisers. */
export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, auth }) => deleteBrand(params.id, auth!.user.id));
