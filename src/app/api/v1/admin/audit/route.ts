import { parseQuery, route } from "@/lib/api";
import { AuditQuery, listAudit } from "@/server/admin/core/audit-log";

/** GET /api/v1/admin/audit?q&entity&actor&from&to&page&limit (ADMIN only) — who did what, newest first, with facets. */
export const GET = route({ auth: "superadmin" }, async ({ req }) => listAudit(parseQuery(req, AuditQuery)));
