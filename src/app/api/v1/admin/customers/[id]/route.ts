import { err, parseBody, route } from "@/lib/api";
import { CustomerPatch, getCustomer, setCustomerActive } from "@/server/admin/core/customers";

/** GET /api/v1/admin/customers/:id — profile, stats, addresses, recent orders. */
export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => {
  const c = await getCustomer(params.id);
  if (!c) throw err.notFound("Customer not found");
  return c;
});

/** PATCH /api/v1/admin/customers/:id { isActive, reason? } — disable (signs out everywhere) or re-enable the account. */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => setCustomerActive(params.id, await parseBody(req, CustomerPatch), auth!.user.id));
