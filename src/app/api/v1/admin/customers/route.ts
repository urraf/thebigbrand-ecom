import { parseQuery, route } from "@/lib/api";
import { CustomerListQuery, listCustomers } from "@/server/admin/core/customers";

/** GET /api/v1/admin/customers?q&status(=active|disabled)&segment(=buyers|repeat|none)&sort(=recent|orders|spent|name|last)&dir&page&limit */
export const GET = route({ auth: "admin" }, async ({ req }) => listCustomers(parseQuery(req, CustomerListQuery)));
