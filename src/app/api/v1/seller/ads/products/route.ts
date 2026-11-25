import { route } from "@/lib/api";
import { promotableProducts } from "@/server/seller/ads";
import { getSellerSlots } from "@/server/seller/options";

/** GET /api/v1/seller/ads/products — my live, in-stock products that can be promoted + the bookable placements. */
export const GET = route({ auth: "seller" }, async ({ seller }) => {
  const [products, slots] = await Promise.all([promotableProducts(seller!.id), getSellerSlots()]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, slug: p.slug, price: p.price, mrp: p.mrp, stock: p.stock, brand: p.brand.name, image: p.images[0] ?? null })),
    slots,
  };
});
