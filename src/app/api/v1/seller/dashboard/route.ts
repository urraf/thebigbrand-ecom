import { route } from "@/lib/api";
import { getSellerDashboard } from "@/server/seller/dashboard";

/** GET /api/v1/seller/dashboard — sales (today / 30 days + daily series), orders to ship, products, balance, low stock, recent orders. */
export const GET = route({ auth: "seller" }, async ({ seller }) => getSellerDashboard(seller!.id));
