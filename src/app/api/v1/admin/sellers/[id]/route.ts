import { err, route } from "@/lib/api";
import { getSeller } from "@/server/admin/growth/sellers";

/** GET /api/v1/admin/sellers/:id (admin) → profile/KYC/bank, products, order items, ledger, payouts, sponsored campaigns, performance */
export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  const s = await getSeller(params.id);
  if (!s) throw err.notFound("Seller not found");
  return s;
});
