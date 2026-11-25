import { parseBody, parseQuery, route } from "@/lib/api";
import { createProduct, listProducts, ProductCreate, ProductListQuery } from "@/server/admin/core/products";

/**
 * GET  /api/v1/admin/products?q&brand&category&seller(=id|tbb)&status&stock(=in|low|out)&sort(=updated|name|price|stock|sold|created)&dir&page&limit
 *      (ARCHIVED products are hidden unless status=ARCHIVED)
 * POST /api/v1/admin/products { name, brandId, categoryId, mrp, price, stock, status?, sellerId?, slug?, sku?, size?, badge?,
 *      description?, howToUse?, ingredients?, bullets[], concerns[], tags[], shape?, colorPrimary?, colorSecondary?, line?,
 *      isFeatured?, isOwnLabel?, images: [{ url, alt? }] }  (upload files first via POST /api/v1/admin/media)
 */
export const GET = route({ auth: "admin" }, async ({ req }) => listProducts(parseQuery(req, ProductListQuery)));

export const POST = route({ auth: "admin" }, async ({ req, auth }) => {
  const body = await parseBody(req, ProductCreate);
  return createProduct(body, auth!.user.id);
});
