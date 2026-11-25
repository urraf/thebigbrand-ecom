import { paginationSchema, parseQuery, route } from "@/lib/api";
import { getSellerBalance, listPayouts } from "@/server/seller/ledger";

/** GET /api/v1/seller/payouts?page=&limit= — payout history + current balance and next payout date. */
export const GET = route({ auth: "seller" }, async ({ req, seller }) => {
  const q = parseQuery(req, paginationSchema);
  const [balance, payouts] = await Promise.all([getSellerBalance(seller!.id), listPayouts(seller!.id, { page: q.page, limit: Math.min(q.limit, 50) })]);
  return { ...balance, ...payouts };
});
