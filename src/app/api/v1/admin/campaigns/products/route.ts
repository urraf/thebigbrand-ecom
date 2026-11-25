import { parseQuery, route } from "@/lib/api";
import { productSearchQuery, searchProducts } from "@/server/admin/growth/campaigns";

/** GET /api/v1/admin/campaigns/products?q=&brandId=&ids=a,b&limit= (admin) → ProductCardData[] for the creative's product picker */
export const GET = route({ auth: "admin" }, async ({ req }) => searchProducts(parseQuery(req, productSearchQuery)));
