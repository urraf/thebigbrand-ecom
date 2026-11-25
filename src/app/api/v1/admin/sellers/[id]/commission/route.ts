import { parseBody, route } from "@/lib/api";
import { commissionSchema, updateCommission } from "@/server/admin/growth/sellers";

/** PATCH /api/v1/admin/sellers/:id/commission (superadmin) { commissionPct: 0–60 } — applies to orders placed afterwards */
export const PATCH = route<{ id: string }>({ auth: "superadmin" }, async ({ req, params, auth }) => {
  const { commissionPct } = await parseBody(req, commissionSchema);
  return updateCommission(params.id, commissionPct, auth!.user.id);
});
