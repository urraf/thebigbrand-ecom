import { route } from "@/lib/api";
import { getBrandOptions, getCategoryOptions, getConcernOptions, getSellerSlots } from "@/server/seller/options";
import { COURIERS, PRODUCT_SHAPES } from "@/server/seller/schemas";
import { INDIAN_STATES } from "@/components/seller/kyc";

/** GET /api/v1/seller/options — lookups for seller forms (categories, brands, concerns, states, couriers, ad slots). */
export const GET = route({ auth: "public" }, async () => {
  const [categories, brands, concerns, slots] = await Promise.all([getCategoryOptions(), getBrandOptions(), getConcernOptions(), getSellerSlots()]);
  return { categories, brands, concerns, slots, states: INDIAN_STATES, couriers: COURIERS, shapes: PRODUCT_SHAPES, commissionPct: 12 };
});
